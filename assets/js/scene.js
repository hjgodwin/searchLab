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

    const worldPosition = new THREE.Vector3()
        const worldPointer = new THREE.Vector3()
        let pointerInitialized = false
        const pointer = new THREE.Vector2()

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

    function createShuffler(rootMesh, spawnPosition, useConvexHull = false) {
            // Create the single kinematic rigid body at the root's spawn position
            let rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
                .setTranslation(spawnPosition.x, spawnPosition.y, spawnPosition.z);
            rigidBodyDesc.setRotation(
                { x: rootMesh.quaternion.x, y: rootMesh.quaternion.y, z: rootMesh.quaternion.z, w: rootMesh.quaternion.w },
                true
            );
    
            const rigidBody = world.createRigidBody(rigidBodyDesc);
            rigidBody.lockRotations(true, true);
    
            // Make sure local transforms are current before we read them
            rootMesh.updateWorldMatrix(true, true);
    
            const colliders = [];
    
            rootMesh.traverse((child) => {
                if (!child.isMesh || !child.geometry) return;
    
                // Get this child's transform RELATIVE TO rootMesh (the rigid body's frame),
                // not relative to world space.
                const localMatrix = new THREE.Matrix4().copy(child.matrixWorld);
                localMatrix.premultiply(new THREE.Matrix4().copy(rootMesh.matrixWorld).invert());
    
                const localPos = new THREE.Vector3();
                const localQuat = new THREE.Quaternion();
                const localScale = new THREE.Vector3();
                localMatrix.decompose(localPos, localQuat, localScale);
    
                let colliderDesc;
    
                if (useConvexHull) {
                    const position = child.geometry.attributes.position;
                    const points = new Float32Array(position.array);
                    colliderDesc = RAPIER.ColliderDesc.convexHull(points);
    
                    if (!colliderDesc) {
                        console.warn("Convex hull failed for", child.name, "- falling back to bounding sphere");
                        child.geometry.computeBoundingSphere();
                        colliderDesc = RAPIER.ColliderDesc.ball(child.geometry.boundingSphere.radius);
                    }
                } else {
                    child.geometry.computeBoundingSphere();
                    colliderDesc = RAPIER.ColliderDesc.ball(child.geometry.boundingSphere.radius);
                }
    
                // Position/orient this collider relative to the rigid body
                colliderDesc.setTranslation(localPos.x, localPos.y, localPos.z);
                colliderDesc.setRotation({ x: localQuat.x, y: localQuat.y, z: localQuat.z, w: localQuat.w });
    
                const collider = world.createCollider(colliderDesc, rigidBody);
                colliders.push(collider);
            });
    
            rootMesh.position.copy(rigidBody.translation());
            rootMesh.quaternion.copy(rigidBody.rotation());
    
            physicsIDs += 1;
            const ID = physicsIDs;
    
            const physicsObject = { RB: rigidBody, COLLIDER: colliders, MESH: rootMesh, ID: ID };
    
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


    const geometry = new THREE.SphereGeometry( 1, 16, 8 );
    const material = new THREE.MeshStandardMaterial( { color: 0xffff00 } );
    const mesh = new THREE.Mesh( geometry, material );
    const cursorObj = createShuffler(mesh,mesh.position,false)
    //const cursorObj = createPhysicsObject(mesh, 'ball')

    //scene.add(mesh);

    const groundGeometry = new THREE.PlaneGeometry(150, 150);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotateX(1.5708)
    //scene.add( ground );
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(75.0, 20, 75.0).setTranslation(0, -20, 0);
    world.createCollider(groundColliderDesc);



    for (let i = 0; i < 150; i++) {
        const cubeSize = _.random(0.5, 1.5, true)
        const cubeGeom = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff * Math.random() });
        const cubeMesh = new THREE.Mesh(cubeGeom, material);
        cubeMesh.position.set(_.random(-10, 10, true), _.random(20, 25, true), _.random(-10, 10, true))
        cubeMesh.rotation.set(_.random(-6.28319, 6.28319, true), _.random(-6.28319, 6.28319, true), _.random(-6.28319, 6.28319, true))
        scene.add(cubeMesh);
        const physObj = createPhysicsObject(cubeMesh);
        physObj.RB.setAngvel({ x: _.random(-2, 2, true), y: _.random(-2, 2, true), z: _.random(-2, 2, true) }, true);
    }



    //console.log(physicsHelper)
    //scene.add(physicsHelper)




    //const controls = new OrbitControls(camera, renderer.domElement);

    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0)
    //controls.update();
    //camera.position.z = 3;



    function mouseToWorld(distanceTarget = null) {
        // distanceTarget determines how far away from the camera this position will be

        // Set world pointer to be x and y NDC 
        worldPointer.set(pointer.x, pointer.y, 0)

        // Convert NDC to world - This places the object at the position of the camera
        worldPointer.unproject(camera);

        // Subtract the camera position from it
        worldPointer.sub(camera.position).normalize();

        // Calculate how far away the object is 
        let distance
        if (distanceTarget == null) {
            // If no object provided, place the object at the zero point of the scene
            distance = camera.position.length()
        } else {
            // Else maintain its current distance
            distance = camera.position.distanceTo(distanceTarget)
        }

        // Add this distance to the coords
        worldPointer.multiplyScalar(distance)

        // Create final position
        worldPosition.copy(camera.position).add(worldPointer)

        return (worldPosition);

    }



    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });



    window.addEventListener('pointermove', function (event) { 
        
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

        const target = mouseToWorld()
        
        cursorObj.RB.setTranslation({ x: target.x, y: target.y, z: target.z }, true);
        cursorObj.RB.setLinvel({ x: 0, y: 0, z: 0 }, true);   
        cursorObj.RB.setAngvel({ x: 0, y: 0, z: 0 }, true);   
        cursorObj.MESH.position.copy(cursorObj.RB.translation());
    })

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

