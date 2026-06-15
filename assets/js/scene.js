import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import _ from "lodash";


let scene, camera, renderer, controls, requestID;
let paused = false
scene = new THREE.Scene();
//scene.fog = new THREE.FogExp2(0x0a0a12, 0.05);

const loadedStimuli = [];
const loadedTextures = [];
const objectsInScene = []

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2()
const raycastableObjects = []
let selectedObject = null

function raycastScene(event = null) {
    raycaster.setFromCamera(pointer, camera);
    // See if the ray from the camera into the world hits one of our meshes
    const intersects = raycaster.intersectObjects(objectsInScene);
    return (intersects)
}




// Loading Manager
const manager = new THREE.LoadingManager();

manager.onLoad = function () {
    init();
};


const container = document.querySelector("div.post-content.md-content");
const width = container.clientWidth;
const height = 500;

const SPHERE_R = 10;
const CUBE_HALF = 0.28;
const PALETTE = [0x6655dd, 0x44bbcc, 0xff6644, 0xffaa22, 0x55cc77, 0xdd44aa, 0x3399ff, 0xeeee55];
const SPEED = 0.01;
const TOTAL_CUBES = 50;

let cubes = [];
let cubeHalves = [];
let velocities = [];
let rotVelocities = [];
//let sphereMesh

const timer = new THREE.Timer();
const sphereGeo = new THREE.SphereGeometry(SPHERE_R, 32, 32);
const sphereMat = new THREE.MeshBasicMaterial({ color: 0x334466, wireframe: true, transparent: true, opacity: 0.5 });
const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
//scene.add(sphereMesh);

//init()



function randInSphere(r) {
    let v;
    do {
        v = new THREE.Vector3(
            _.random(-1, 1, true),
            _.random(-1, 1, true),
            _.random(-1, 1, true)
        );
    } while (v.length() > 1);
    return v.multiplyScalar(r * 0.8);
}

function randVel() {
    return new THREE.Vector3(
        _.random(-1, 1, true),
        _.random(-1, 1, true),
        _.random(-1, 1, true)
    ).normalize().multiplyScalar(SPEED);
}

function randRotVel() {
    return new THREE.Vector3(
        _.random(-0.03, 0.03, true),
        _.random(-0.03, 0.03, true),
        _.random(-0.03, 0.03, true)
    );
}

function buildCubes() {
    const updatedTotalCubes = TOTAL_CUBES - loadedStimuli.length;

    for (let i = 0; i < loadedStimuli.length; i++) {
        const mesh = loadedStimuli[i]
        let randScale
        if(mesh.name.includes("DISTRACTOR") | mesh.name.includes("TARGET")){
            randScale = _.random(0.1, 0.25, true);
        }else{
            randScale = _.random(0.1, 0.5, true);
        }
        
        mesh.scale.set(randScale,randScale,randScale)
        

        const bbox = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const half = Math.max(size.x, size.y, size.z) / 2;

        mesh.position.copy(randInSphere(SPHERE_R));
        scene.add(mesh);
        objectsInScene.push(mesh)
        cubes.push(mesh);
        cubeHalves.push(half);
        velocities.push(randVel());
        rotVelocities.push(randRotVel());
    }

    for (let i = 0; i < updatedTotalCubes; i++) {
        const half = CUBE_HALF * _.random(0.25, 1.0, true);
        const geo = new THREE.BoxGeometry(half * 2, half * 2, half * 2);
        const mat = new THREE.MeshStandardMaterial({
            color: PALETTE[i % PALETTE.length],
            roughness: _.random(0.1,1,true)
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(randInSphere(SPHERE_R));
        mesh.userData.cardName = 'Other'
        scene.add(mesh);
        objectsInScene.push(mesh)
        cubes.push(mesh);
        cubeHalves.push(half);
        velocities.push(randVel());
        rotVelocities.push(randRotVel());
    }
}



function applyVelocities(cube, vel, rotVel, delta) {
    cube.position.addScaledVector(vel, delta * 30);
    cube.rotation.x += rotVel.x * delta * 30;
    cube.rotation.y += rotVel.y * delta * 30;
    cube.rotation.z += rotVel.z * delta * 30;
}

function checkIfInSphere(cube, half) {
    return cube.position.length() > SPHERE_R - half * 1.5;
}

function reflectBack(cube, vel, half) {
    const dist = cube.position.length();
    const normal = cube.position.clone().divideScalar(dist);
    vel.reflect(normal);
    cube.position.copy(normal.multiplyScalar(SPHERE_R - half * 1.5));
}

function processCollisions(cube, vel, half, i, delta) {
    const pos = cube.position;
    for (let j = i + 1; j < TOTAL_CUBES; j++) {
        const posJ = cubes[j].position;
        const dx = pos.x - posJ.x;
        const dy = pos.y - posJ.y;
        const dz = pos.z - posJ.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        const contactDist = (half + cubeHalves[j]) * 2.2;
        const contactDistSq = contactDist * contactDist;

        if (distSq < contactDistSq && distSq > 0.0001) {
            const sep = Math.sqrt(distSq);
            const invSep = 1 / sep;
            const ax = dx * invSep;
            const ay = dy * invSep;
            const az = dz * invSep;

            const velJ = velocities[j];

            const dotI = vel.x * ax + vel.y * ay + vel.z * az;
            const dotJ = velJ.x * ax + velJ.y * ay + velJ.z * az;

            const dDot = dotI - dotJ;
            vel.x -= dDot * ax; vel.y -= dDot * ay; vel.z -= dDot * az;
            velJ.x += dDot * ax; velJ.y += dDot * ay; velJ.z += dDot * az;

            const push = (contactDist - sep) * 0.5 * delta * 60 + 0.01;
            const scale = push * invSep;
            pos.x += dx * scale; pos.y += dy * scale; pos.z += dz * scale;
            posJ.x -= dx * scale; posJ.y -= dy * scale; posJ.z -= dz * scale;
        }
    }
}

function update(delta) {
    for (let i = 0; i < TOTAL_CUBES; i++) {
        const cube = cubes[i];
        const vel = velocities[i];
        const rotVel = rotVelocities[i];
        const half = cubeHalves[i];

        applyVelocities(cube, vel, rotVel, delta);

        if (checkIfInSphere(cube, half)) {
            reflectBack(cube, vel, half);
        }

        processCollisions(cube, vel, half, i, delta);
    }

    sphereMesh.rotation.y += 0.002 * delta * 60;
}

function init() {
    /////////////////////////////////////////////////////////////////////////
    // SETUP RENDERER ///////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x0a0a12, 1);

    //document.body.appendChild(renderer.domElement);
    document.getElementById("three-root").appendChild(renderer.domElement);



    camera = new THREE.PerspectiveCamera(10, width / height, 0.1, 1000);
    camera.position.z = 50;


    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x88aaff, 1.2);
    dirLight.position.set(5, 8, 6);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xff6644, 0.5);
    rimLight.position.set(-5, -4, -3);
    scene.add(rimLight);

    const gridSize = 150;
    const divisions = 50;
    const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x00A32C, 0x00A32C);
    
    gridHelper.material.opacity = 0.35;
    gridHelper.material.transparent = true;
    
    gridHelper.rotateX(1.5708);
    gridHelper.position.z = -400;
    scene.add(gridHelper);

    window.addEventListener('resize', onWindowResize);
    /////////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////////
    // SETUP CONTROLS////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////
    //controls = new OrbitControls(camera, renderer.domElement);
    /////////////////////////////////////////////////////////////////////////






    container.addEventListener('pointermove', (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
    });

    container.addEventListener('pointerdown', (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const intersects = raycastScene()
        console.log(intersects)

        if (!paused & intersects.length > 0) {
            selectedObject = intersects[0].object
            console.log(selectedObject.userData)
            paused = true
            const card = CARDS.find(card => card.name === selectedObject.userData.cardName)
            document.body.appendChild(makeCard(card));
        }
    });


    buildCubes();

    animate();
}

function clearScene() {
    for (let i = 0; i < objectsInScene.length; i++) {
        const objToRemove = objectsInScene[i]
        scene.remove(objToRemove)
    }

    objectsInScene.length = 0;
}


function preLoadModels() {
    /////////////////////////////////////////////////////////////////////////
    // LOAD 3D MODELS ///////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////// 
    const objectLoader = new GLTFLoader(manager);
    let stimuliToLoad = ["DISTRACTOR_CUBE_1", "TARGET_CUBE_1", "hadenCube", "haywardCube", "prasadCube", "mansiCube", "coinPaperCube","easyDoesItCube","emmaPaperCube","noStoneUnturnedCube"];
    let modelPath = 'models/';

    for (let i = 0; i < stimuliToLoad.length; i++) {// Load a glTF resource
        objectLoader.load(
            // resource URL
            modelPath + stimuliToLoad[i] + ".glb",
            // called when the resource is loaded
            function (gltf) {
                const model = gltf.scene;
                const modelName = stimuliToLoad[i]
                let cardName

                if(modelName == ('DISTRACTOR_CUBE_1')){cardName = 'DistractorCube'}
                if(modelName == ('TARGET_CUBE_1')){cardName = 'TargetCube'}

                if(modelName == ('hadenCube')){cardName = 'Haden'}
                if(modelName == ('haywardCube')){cardName = 'Hayward'}
                if(modelName == ('prasadCube')){cardName = 'Prasad'}
                if(modelName == ('mansiCube')){cardName = 'Mansi'}
                if(modelName == ('coinPaperCube')){cardName = 'coinPaper'}
                if(modelName == ('easyDoesItCube')){cardName = 'easyDoesIt'}
                if(modelName == ('emmaPaperCube')){cardName = 'emmaPaper'}
                if(modelName == ('noStoneUnturnedCube')){cardName = 'noStoneUnturned'}

                


                // TRAVERSE IF NEEDED // 
                model.userData.cardName = cardName
                model.traverse((o) => {
                    if (o.isMesh) {
                        //o.material.roughness = 0.8;
                        o.userData.cardName = cardName
                    }
                });

                if(modelName == ('DISTRACTOR_CUBE_1')){
                    model.name = 'DISTRACTOR_CUBE'
                    loadedStimuli.push(model);
                    for(let j = 0; j < 5; j++){
                        const dClone = model.clone()
                        loadedStimuli.push(dClone);
                    }
                }
                else if(modelName == ('TARGET_CUBE_1')){
                    model.name = 'TARGET_CUBE'
                    loadedStimuli.push(model);
                    for(let j = 0; j < 3; j++){
                        const tClone = model.clone()
                        loadedStimuli.push(tClone);
                    }
                }
                else{
                    // Save to array 
                    loadedStimuli.push(model);
                }

                

                // Add to scene 
                //scene.add(model);
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

function preLoadTextures() {
    /////////////////////////////////////////////////////////////////////////
    // SETUP HDRIs //////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////
    const hdrEquirectangularMap = new HDRLoader(manager);

    hdrEquirectangularMap.load('Textures/indoorHDR.hdr', function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        texture.name = 'indoorHDR';
        //scene.environment = texture;
        //scene.background = texture;
    });
    /////////////////////////////////////////////////////////////////////////

    // Load images and textures here...
    const textureLoader = new THREE.TextureLoader(manager);
    let texturePath = 'Textures/';
    let texturesToLoad = [];

    for (let i = 0; i < texturesToLoad.length; i++) {
        // load a resource
        textureLoader.load(
            // resource URL
            texturePath + texturesToLoad[i],

            // onLoad callback
            function (texture) {
                loadedTextures.push(texture);
            },

            // onProgress callback currently not supported
            undefined,

            // onError callback
            function (err) {
                console.error('An error happened.');
            }
        );

    }

}


function onWindowResize() {
    const w = container.clientWidth;
    const h = 500;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);

}


function animate() {
    requestID = requestAnimationFrame(animate);
    timer.update();

    const delta = Math.min(timer.getDelta(), 0.1);
    if (!paused) { update(delta); }
    renderer.render(scene, camera);
}




const CSS = `
  .card {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 360px;
    z-index: 9999;
    background: #111113;
    border: 1px solid #2a2a2e;
    border-radius: 10px;
    padding: 14px 16px 12px;
    font-family: sans-serif;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto auto;
    column-gap: 10px;
    animation: drop 0.18s cubic-bezier(0.22,1,0.36,1);
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent 100%);
  }
  @keyframes drop {
    from { opacity: 0; transform: translate(-50%, -46%) scale(0.98); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  .card-label {
    grid-column: 1; grid-row: 1;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #555;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .card-close {
    grid-column: 2; grid-row: 1 / 4;
    align-self: start;
    background: none;
    border: none;
    color: #3a3a3e;
    cursor: pointer;
    padding: 0;
    font-size: 18px;
    line-height: 1;
    transition: color 0.1s;
    margin-top: 1px;
  }
  .card-close:hover { color: #888; }
  .card-title {
    grid-column: 1; grid-row: 2;
    font-size: 14px;
    font-weight: 500;
    color: #dddde0;
    margin: 0 0 6px;
    line-height: 1.3;
  }
  .card-body {
    grid-column: 1; grid-row: 3;
    font-size: 12.5px;
    color: #666;
    line-height: 1.55;
    margin: 0;
  }
`;
const s = document.createElement('style');
s.textContent = CSS;
document.head.appendChild(s);

function makeCard(data) {
    const el = document.createElement('div');
    el.className = `card type-${data.type}`;

    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = data.label;

    const title = document.createElement('p');
    title.className = 'card-title';
    title.textContent = data.title;

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = data.body;

    const close = document.createElement('button');
    close.className = 'card-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '×';
    close.addEventListener('click', () => {
        el.style.transition = 'opacity 0.12s';
        el.style.opacity = '0';
        setTimeout(() => {
            el.remove();
            paused = false;  // resume the scene
        }, 130);
    });

    el.append(label, close, title, body);
    console.log(el)
    return el;
}

const CARDS = [
    {
    name: 'easyDoesIt', 
    type: 'plain',
    label: 'Paper',
    title: 'Easy does it: Selection during interactive search tasks is biased towards objects that can be examined easily',
    body: `
    <p>Our findings suggest that the perceived effort required to interact with an object is an extremely strong driver of attentional selection within interactive search behaviors. Here, targets may be slower to be detected when that target is obscured within or by an object that conveys, in some shape or form, greater difficulty to examine compared with other objects</p>
    <a href="https://doi.org/10.3758/s13414-025-03083-w" target="_blank">Read it here!</a>
    `},
    {
    name: 'coinPaper', 
    type: 'plain',
    label: 'Paper',
    title: 'What Drives Object Selection? The Combined Role of Temporal Costs and Effort During Interactive Search',
    body: `
    <p>In our task, we found that searchers would first use a combination of both perceived effort and time to determine what makes an object “easy” or “hard” to interact with in relation to all other objects, before prioritizing interactions with said easier objects.</p>
    <a href="https://doi.org/10.1177/17470218261436006" target="_blank">Read it here!</a>
    `},
    {
    name: 'noStoneUnturned', 
    type: 'plain',
    label: 'Paper',
    title: 'No stone unturned: Prevalence effects in interactive search are different than those in visual search',
    body: `
    <p>We found strong evidence against the influence of target-prevalence upon response times and all other search exhaustiveness measures. Contrary to traditional visual search findings, changes in response accuracy were not a result of reductions in search exhaustiveness. We conclude that, during interactive search, even when prevalence is low, searchers operate under a no-stone-unturned approach. Under this approach, searchers are unwilling to provide an “absent” response without checking most—if not all—possible places, regions or areas in a display that could contain a target.</p>
    <a href="https://doi.org/10.3758/s13423-026-02919-2" target="_blank">Read it here!</a>
    `},
    {
    name: 'emmaPaper', 
    type: 'plain',
    label: 'Paper',
    title: 'How do the eﬀects of eﬀort influence interactivesearch behavior?',
    body: `
    <p>We offer three important contributions to the literature. First, our methodology enabled us to determine that, within our study, interactive search utilized a “nearest-next” strategy, with searchers choosing to interact with the nearest cube to them on each trial. Second, contrary to expectations from purely visual search tasks, rather than waiting and examining the already-visible cube faces at the start of each trial, searchers opted instead to begin interacting with objects immediately. Third, response accuracy rates were no different between target-present and target-absent trials, suggesting that there is at least one point at which interactive search differs from visual search.</p>
    <a href="https://doi.org/10.3758/s13414-025-03083-w" target="_blank">Read it here!</a>
    `},
    {
    name: 'Haden', 
    type: 'plain',
    label: 'Lab Member',
    title: 'Haden Dewis',
    body: `
    <p>Some info about Haden</p>
    <a href="" target="_blank">Full bio here.</a>
    `},
    {
    name: 'Hayward', 
    type: 'plain',
    label: 'Lab Member',
    title: 'Hayward Godwin',
    body: `
    <p>Some info about Hayward</p>
    <a href="" target="_blank">Full bio here.</a>
    `},
    {
    name: 'Prasad', 
    type: 'plain',
    label: 'Lab Member',
    title: 'Prasad Mane',
    body: `
    <p>Some info about Prasad</p>
    <a href="" target="_blank">Full bio here.</a>
    `},
    {
    name: 'Emma', 
    type: 'plain',
    label: 'Lab Member',
    title: 'Emma Deverill',
    body: `
    <p>Some info about Emma</p>
    <a href="" target="_blank">Full bio here.</a>
    `},
    {
    name: 'Mansi', 
    type: 'plain',
    label: 'Lab Member',
    title: 'Mansi Pattni',
    body: `
    <p>Some info about Mansi</p>
    <a href="" target="_blank">Full bio here.</a>
    `},
    {
    name: 'DistractorCube', 
    type: 'plain',
    label: 'Stimuli',
    title: 'Distractor Cube',
    body: `
    <p>Some info about distractor cubes</p>
    `},
    {
    name: 'TargetCube', 
    type: 'plain',
    label: 'Stimuli',
    title: 'Target Cube',
    body: `
    <p>Some info about distractor cubes</p>
    `},
    {
    name: 'Other', 
    type: 'plain',
    label: 'Other',
    title: 'Random Cube',
    body: `
    <p>Some info about random cube</p>
    `}
]

//preLoadTextures();
preLoadModels();