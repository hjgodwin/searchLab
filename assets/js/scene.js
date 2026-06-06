import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import _ from "lodash"

const loadedStimuli = [];
const loadedTextures = [];

// Loading Manager
const manager = new THREE.LoadingManager();

manager.onLoad = function () {
    animate();
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a12, 0.01);

const container = document.querySelector("div.post-content.md-content");
const width = container.clientWidth;
const height = 500;
let requestID;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x0a0a12, 1);

const camera = new THREE.PerspectiveCamera(10, width / height, 0.75, 1000);
camera.position.z = 20;
document.getElementById("three-root").appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x88aaff, 1.2);
dirLight.position.set(5, 8, 6);
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0xff6644, 0.5);
rimLight.position.set(-5, -4, -3);
scene.add(rimLight);

const SPHERE_R = 4;
const CUBE_HALF = 0.28;
const PALETTE = [0x6655dd, 0x44bbcc, 0xff6644, 0xffaa22, 0x55cc77, 0xdd44aa, 0x3399ff, 0xeeee55];
const SPEED = 0.01;
const TOTAL_CUBES = 20;

let cubes = [];
let cubeHalves = [];
let velocities = [];
let rotVelocities = [];

const timer = new THREE.Timer();

const sphereGeo = new THREE.SphereGeometry(SPHERE_R, 32, 32);
const sphereMat = new THREE.MeshBasicMaterial({ color: 0x334466, wireframe: true, transparent: true, opacity: 0.12 });
const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
scene.add(sphereMesh);

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
  for (let i = 0; i < TOTAL_CUBES; i++) {
    const half = CUBE_HALF * _.random(0.25, 1.0, true);
    const geo = new THREE.BoxGeometry(half * 2, half * 2, half * 2);
    const mat = new THREE.MeshPhongMaterial({
      color: PALETTE[i % PALETTE.length],
      shininess: 90,
      flatShading: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(randInSphere(SPHERE_R));
    scene.add(mesh);
    cubes.push(mesh);
    cubeHalves.push(half);
    velocities.push(randVel());
    rotVelocities.push(randRotVel());
  }
}

buildCubes();

function applyVelocities(cube, vel, rotVel, delta) {
  cube.position.addScaledVector(vel, delta * 60);
  cube.rotation.x += rotVel.x * delta * 60;
  cube.rotation.y += rotVel.y * delta * 60;
  cube.rotation.z += rotVel.z * delta * 60;
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


function preLoadModels() {
    /////////////////////////////////////////////////////////////////////////
    // LOAD 3D MODELS ///////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////// 
    const objectLoader = new GLTFLoader(manager);
    let stimuliToLoad = ['DISTRACTOR_CUBE_1.glb'];
    let modelPath = '/models/';

    for (let i = 0; i < stimuliToLoad.length; i++) {// Load a glTF resource
        objectLoader.load(
            // resource URL
            modelPath + stimuliToLoad[i] + ".glb",
            // called when the resource is loaded
            function (gltf) {

                let model = gltf.scene;

                // TRAVERSE IF NEEDED // 
                /*
                cube.traverse((o) => {
                    if (o.isMesh) {
                        o.material.roughness = 0.8;
                    }
                });*/

                // Save to array 
                loadedStimuli.push(model);

                // Add to scene 
                scene.add(model);
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


const controls = new OrbitControls(camera, renderer.domElement);

function animate() {
  requestID = requestAnimationFrame(animate);
  timer.update();
  
  const delta = Math.min(timer.getDelta(), 0.1);
  update(delta);
  renderer.render(scene, camera);
}

preLoadModels()

//animate();
