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
    const colourList = [0xff643c, 0xf73232, 0xf50a64, 0xeb00aa, 0xb432b4, 0x6e3bc8, 0x2d78eb, 0x35a5eb, 0x30aaab, 0x3c966e, 0x3cc85a, 0x78be00, 0xbed200, /*0xebeb00,*/ 0xd7c300, 0xf0aa02];
    const loadedModels = []

    const manager = new THREE.LoadingManager();

    manager.onLoad = function () {
        init();
    };

    const worldPosition = new THREE.Vector3()
    const worldPointer = new THREE.Vector3()
    let pointerInitialized = false
    const pointer = new THREE.Vector2()

    function createPhysicsObject(target, type = "cuboid") {
        // Collect the meshes this physics body needs colliders for.
        // A single Mesh -> one collider (original behavior, unchanged).
        // A Group/Object3D -> compound body: one collider per descendant mesh.
        const isGroup = !target.isMesh;
        const meshes = isGroup ? [] : [target];
        if (isGroup) {
            target.traverse(child => {
                if (child.isMesh) meshes.push(child);
            });
            if (meshes.length === 0) {
                throw new Error(`createPhysicsObject: "${target.name}" is a group with no mesh descendants`);
            }
        }

        // Rigid body sits at the target's own world transform (mesh or group root).
        const rootPosition = new THREE.Vector3();
        target.getWorldPosition(rootPosition);
        const rootQuaternion = new THREE.Quaternion();
        target.getWorldQuaternion(rootQuaternion);

        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
        rigidBodyDesc.setTranslation(rootPosition.x, rootPosition.y, rootPosition.z);
        rigidBodyDesc.setRotation({ x: rootQuaternion.x, y: rootQuaternion.y, z: rootQuaternion.z, w: rootQuaternion.w });
        const rigidBody = world.createRigidBody(rigidBodyDesc);

        // Precompute the root's inverse world matrix so each mesh's collider can
        // be offset relative to the rigid body (this is what makes it "compound").
        target.updateWorldMatrix(true, false);
        const rootMatrixInverse = new THREE.Matrix4().copy(target.matrixWorld).invert();

        const colliders = [];

        for (const mesh of meshes) {
            const colliderDesc = buildColliderDesc(mesh, type);

            if (isGroup) {
                mesh.updateWorldMatrix(true, false);
                const relative = new THREE.Matrix4().multiplyMatrices(rootMatrixInverse, mesh.matrixWorld);
                const relPos = new THREE.Vector3();
                const relQuat = new THREE.Quaternion();
                const relScale = new THREE.Vector3(); // unused — see note below
                relative.decompose(relPos, relQuat, relScale);

                colliderDesc.setTranslation(relPos.x, relPos.y, relPos.z);
                colliderDesc.setRotation({ x: relQuat.x, y: relQuat.y, z: relQuat.z, w: relQuat.w });
            }

            const collider = world.createCollider(colliderDesc, rigidBody);

            mesh.userData.RB = rigidBody;
            mesh.userData.COLLIDER = collider;

            colliders.push(collider);
        }

        physicsIDs += 1;
        const ID = physicsIDs;
        target.userData.ID = ID;
        target.userData.RB = rigidBody;
        if (!isGroup) target.userData.COLLIDER = colliders[0];

        const physicsObject = {
            RB: rigidBody,
            COLLIDER: colliders[0],
            COLLIDERS: colliders,
            MESH: target,
            ID: ID
        };
        physicsObjects.push(physicsObject);

        return physicsObject;
    }

    // Builds a ColliderDesc from a mesh's *local* (untransformed) geometry.
    // Shared by both the single-mesh path and each part of a compound body.
    function buildColliderDesc(mesh, type) {
        const scale = mesh.getWorldScale(new THREE.Vector3());

        if (type === "cuboid") {
            const size = new THREE.Vector3();
            mesh.geometry.computeBoundingBox();
            mesh.geometry.boundingBox.getSize(size);
            size.multiply(scale);   // apply scale per-axis
            size.divideScalar(2);
            return RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z);

        } else if (type === "ball") {
            mesh.geometry.computeBoundingSphere();
            let radius = mesh.geometry.boundingSphere.radius;

            if (Math.abs(scale.x - scale.y) > 1e-5 || Math.abs(scale.y - scale.z) > 1e-5) {
                console.warn(`Non-uniform scale on "${mesh.name}" — Rapier balls can't be ellipsoids, using average scale`);
            }
            radius *= (scale.x + scale.y + scale.z) / 3;
            return RAPIER.ColliderDesc.ball(radius);

        } else if (type === "capsule") {
            mesh.geometry.computeBoundingBox();
            const size = new THREE.Vector3();
            mesh.geometry.boundingBox.getSize(size);
            size.multiply(scale);

            if (Math.abs(scale.x - scale.z) > 1e-5) {
                console.warn(`Non-uniform X/Z scale on "${mesh.name}" — capsule radius will use X`);
            }
            const radius = Math.max(size.x, size.z) / 2;
            const halfHeight = Math.max(0, (size.y / 2) - radius);
            return RAPIER.ColliderDesc.capsule(halfHeight, radius);

        } else if (type === "convex") {
            const positionAttr = mesh.geometry.attributes.position;
            const vertices = new Float32Array(positionAttr.count * 3);
            for (let i = 0; i < positionAttr.count; i++) {
                vertices[i * 3] = positionAttr.getX(i) * scale.x;
                vertices[i * 3 + 1] = positionAttr.getY(i) * scale.y;
                vertices[i * 3 + 2] = positionAttr.getZ(i) * scale.z;
            }

            let colliderDesc = RAPIER.ColliderDesc.convexHull(vertices);
            if (!colliderDesc) {
                console.warn("convexHull failed — falling back to cuboid for", mesh.name);
                mesh.geometry.computeBoundingBox();
                const size = new THREE.Vector3();
                mesh.geometry.boundingBox.getSize(size);
                size.multiply(scale).divideScalar(2);
                colliderDesc = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z);
            }
            return colliderDesc;

        } else if (type === "trimesh") {
            const geo = mesh.geometry.index ? mesh.geometry.clone() : mesh.geometry;

            const positionAttr = geo.attributes.position;
            const vertices = new Float32Array(positionAttr.count * 3);
            for (let i = 0; i < positionAttr.count; i++) {
                vertices[i * 3] = positionAttr.getX(i) * scale.x;
                vertices[i * 3 + 1] = positionAttr.getY(i) * scale.y;
                vertices[i * 3 + 2] = positionAttr.getZ(i) * scale.z;
            }

            let indices;
            if (geo.index) {
                indices = new Uint32Array(geo.index.array);
            } else {
                indices = new Uint32Array(positionAttr.count);
                for (let i = 0; i < positionAttr.count; i++) indices[i] = i;
            }

            return RAPIER.ColliderDesc.trimesh(vertices, indices);

        } else {
            throw new Error(`Unknown collider type: "${type}"`);
        }
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

    function preLoadModels() {
        /////////////////////////////////////////////////////////////////////////
        // LOAD 3D MODELS ///////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////// 
        const objectLoader = new GLTFLoader(manager);
        let stimuliToLoad = [
            'DISTRACTOR_CUBE'
        ];
        //'1x1Brick', '1x2Brick', '1x2Plate', '1x2PlateSingle', '1x4Brick', '1x4Plate', '2x1Slope', '2x2Brick', '2x2Slope', '2x4Brick', 'Arch'
        let modelPath = 'models/';

        for (let i = 0; i < stimuliToLoad.length; i++) {// Load a glTF resource
            objectLoader.load(
                // resource URL
                modelPath + stimuliToLoad[i] + ".glb",
                // called when the resource is loaded
                function (gltf) {
                    const model = gltf.scene;

                    model.traverse(function (obj) {
                        if (obj.isMesh) {
                            if (obj.name.includes("BASE")) {
                                obj.material = new THREE.MeshStandardMaterial({ color: _.sample(colourList) })
                            }
                        }
                    })

                    loadedModels.push(model)

                },

                function (xhr) {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                // called when loading has errors
                function (error) {
                    console.log('An error happened', error);
                }
            )
        };
        /////////////////////////////////////////////////////////////////////////
    }

    const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    const physicsHelper = new RapierHelper(world);
    const physicsObjects = []
    let scene, renderer, camera

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

    scene = new THREE.Scene();


    function init() {

        camera = new THREE.PerspectiveCamera(
            30, container.clientWidth / container.clientHeight, 0.1, 1000
        );

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio)
        container.appendChild(renderer.domElement);


        const geometry = new THREE.SphereGeometry(1, 16, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const mesh = new THREE.Mesh(geometry, material);
        const cursorObj = createShuffler(mesh, mesh.position, false)
        //const cursorObj = createPhysicsObject(mesh, 'ball')

        //scene.add(mesh);

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

        const groundGeometry = new THREE.PlaneGeometry(150, 150);
        const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotateX(1.5708)
        //scene.add( ground );
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(75.0, 20, 75.0).setTranslation(0, -20, 0);
        world.createCollider(groundColliderDesc);

        for (let i = 0; i < 150; i++) {
            const cubeMesh = _.sample(loadedModels).clone()
            cubeMesh.scale.set(0.5, 0.5, 0.5)
            cubeMesh.traverse(function (obj) {
                if (obj.isMesh) {
                    if (obj.name.includes("BASE")) {
                        obj.material = new THREE.MeshStandardMaterial({ color: _.sample(colourList) })
                    }
                }
            })
            /*const cubeSize = _.random(0.5, 1.5, true)
            const cubeGeom = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
            const material = new THREE.MeshStandardMaterial({ color: 0xffffff * Math.random() });
            const cubeMesh = new THREE.Mesh(cubeGeom, material);*/
            cubeMesh.position.set(_.random(-10, 10, true), _.random(20, 25, true), _.random(-10, 10, true))
            cubeMesh.rotation.set(_.random(-6.28319, 6.28319, true), _.random(-6.28319, 6.28319, true), _.random(-6.28319, 6.28319, true))
            scene.add(cubeMesh);
            const physObj = createPhysicsObject(cubeMesh);
            physObj.RB.setAngvel({ x: _.random(-2, 2, true), y: _.random(-2, 2, true), z: _.random(-2, 2, true) }, true);
        }



        console.log(physicsHelper)
        scene.add(physicsHelper)




        //const controls = new OrbitControls(camera, renderer.domElement);

        camera.position.set(0, 20, 0);
        camera.lookAt(0, 0, 0)
        //controls.update();
        //camera.position.z = 3;

        animate();
        physicsIntervalID = setInterval(physicsStep, 1000 / 60)
    }





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
    preLoadModels();

});

