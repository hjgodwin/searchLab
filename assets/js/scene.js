import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RapierHelper } from 'three/addons/helpers/RapierHelper.js';
import _ from "lodash";
//import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';

RAPIER.init().then(() => {
    let physicsIntervalID
    let physicsIDs = -1;

    const manager = new THREE.LoadingManager();

    manager.onLoad = function () {
        animate();
        physicsIntervalID = setInterval(physicsStep, 1000 / 60)
    };

    function createPhysicsObject(mesh, type = "cuboid") {
        let rigidBodyDesc, colliderDesc;

        const position = new THREE.Vector3()
        mesh.getWorldPosition(position);
        const quaternion = mesh.quaternion;

        // Helper to set up a dynamic rigid body at the mesh's transform
        function makeRigidBody() {
            const desc = RAPIER.RigidBodyDesc.dynamic();
            desc.setTranslation(position.x, position.y, position.z);
            desc.setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w });
            return desc;
        }

        if (type === "cuboid") {
            const size = new THREE.Vector3();
            mesh.geometry.computeBoundingBox();
            mesh.geometry.boundingBox.getSize(size);
            size.divideScalar(2);

            rigidBodyDesc = makeRigidBody();
            colliderDesc = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z);

        } else if (type === "ball") {
            mesh.geometry.computeBoundingSphere();
            const radius = mesh.geometry.boundingSphere.radius;

            rigidBodyDesc = makeRigidBody();
            colliderDesc = RAPIER.ColliderDesc.ball(radius);

        } else if (type === "capsule") {
            // Capsule is oriented along Y by default in Rapier.
            // halfHeight is the half-length of the cylindrical shaft (excluding the two end caps).
            mesh.geometry.computeBoundingBox();
            const size = new THREE.Vector3();
            mesh.geometry.boundingBox.getSize(size);

            const radius = Math.max(size.x, size.z) / 2;
            const halfHeight = Math.max(0, (size.y / 2) - radius);

            rigidBodyDesc = makeRigidBody();
            colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);

        } else if (type === "convex") {
            // Extract world-space vertex positions from the geometry
            const positionAttr = mesh.geometry.attributes.position;
            const vertices = new Float32Array(positionAttr.count * 3);
            for (let i = 0; i < positionAttr.count; i++) {
                vertices[i * 3] = positionAttr.getX(i);
                vertices[i * 3 + 1] = positionAttr.getY(i);
                vertices[i * 3 + 2] = positionAttr.getZ(i);
            }

            rigidBodyDesc = makeRigidBody();
            colliderDesc = RAPIER.ColliderDesc.convexHull(vertices);
            if (!colliderDesc) {
                console.warn("convexHull failed — falling back to cuboid for", mesh.name);
                mesh.geometry.computeBoundingBox();
                const size = new THREE.Vector3();
                mesh.geometry.boundingBox.getSize(size);
                size.divideScalar(2);
                colliderDesc = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z);
            }

        } else if (type === "trimesh") {
            // Extract vertices and triangle indices from the geometry
            const geo = mesh.geometry.index
                ? mesh.geometry.clone() // keep indexed form
                : mesh.geometry;

            const positionAttr = geo.attributes.position;
            const vertices = new Float32Array(positionAttr.count * 3);
            for (let i = 0; i < positionAttr.count; i++) {
                vertices[i * 3] = positionAttr.getX(i);
                vertices[i * 3 + 1] = positionAttr.getY(i);
                vertices[i * 3 + 2] = positionAttr.getZ(i);
            }

            let indices;
            if (geo.index) {
                indices = new Uint32Array(geo.index.array);
            } else {
                // Non-indexed: generate sequential indices
                indices = new Uint32Array(positionAttr.count);
                for (let i = 0; i < positionAttr.count; i++) indices[i] = i;
            }

            rigidBodyDesc = makeRigidBody();
            colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

        } else {
            throw new Error(`Unknown collider type: "${type}"`);
        }

        const rigidBody = world.createRigidBody(rigidBodyDesc);
        const collider = world.createCollider(colliderDesc, rigidBody);

        mesh.userData.RB = rigidBody
        mesh.userData.COLLIDER = collider

        physicsIDs += 1
        const ID = physicsIDs
        mesh.userData.ID = ID

        const physicsObject = { RB: rigidBody, COLLIDER: collider, MESH: mesh, ID: ID }
        physicsObjects.push(physicsObject);

        return physicsObject;
    }

    function preLoadTextures() {
        /////////////////////////////////////////////////////////////////////////
        // SETUP HDRIs //////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////////
        const hdrEquirectangularMap = new HDRLoader(manager);

        hdrEquirectangularMap.load('models/smallStudio.hdr', function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
            texture.name = 'studioHDR';
            scene.environment = texture;
            scene.environmentIntensity = 0.8;
        });

    }

    const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    const physicsHelper = new RapierHelper(world);
    const physicsObjects = []

    const container = document.createElement("div");
    container.id = "three-root";

    document.body.appendChild(container);

    container.id = "three-root";
    document.body.prepend(container);

    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.zIndex = "-1";

    //const container = document.getElementById('three-root');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        30, container.clientWidth / container.clientHeight, 0.1, 1000
    );

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement);


    const geometry = new THREE.TorusKnotGeometry(0.7, 0.2, 100, 16);
    const material = new THREE.MeshNormalMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    //scene.add(mesh);

    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotateX(1.5708)
    //scene.add( ground );
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(25.0, 0.01, 25.0);
    world.createCollider(groundColliderDesc);



    for (let i = 0; i < 100; i++) {
        const cubeSize = _.random(0.5, 1.5, true)
        const cubeGeom = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff * Math.random() });
        const cubeMesh = new THREE.Mesh(cubeGeom, material);
        cubeMesh.position.set(_.random(-10, 10, true), _.random(20, 25, true), _.random(-10, 10, true))
        cubeMesh.rotation.set(_.random(-6.28319, 6.28319, true), _.random(-6.28319, 6.28319, true), _.random(-6.28319, 6.28319, true))
        scene.add(cubeMesh);
        const physObj = createPhysicsObject(cubeMesh);
        physObj.RB.setAngvel({ x: _.random(-1, 1, true), y: _.random(-1, 1, true), z: _.random(-1, 1, true) }, true);
    }



    //console.log(physicsHelper)
    //scene.add(physicsHelper)




    const controls = new OrbitControls(camera, renderer.domElement);

    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0)
    controls.update();
    //camera.position.z = 3;

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        mesh.rotation.x += 0.005;
        mesh.rotation.y += 0.008;
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });



    //window.addEventListener('pointermove', function () { console.log('moving') })

    function physicsStep() {
        for (let i = physicsObjects.length - 1; i >= 0; i--) {
            const PhysObj = physicsObjects[i];
            const RB = PhysObj.RB;
            const mesh = PhysObj.MESH;
            mesh.position.copy(RB.translation());
            mesh.quaternion.copy(RB.rotation());
        }


        physicsHelper.update();
        world.step();
    }

    

    preLoadTextures();

});

