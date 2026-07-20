import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import _ from "lodash";
//import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';

RAPIER.init().then(() => {
    // Run the simulation.
    console.log('done')
});



const container = document.createElement("div");
container.id = "three-root";

document.body.prepend(container);

console.log(document.body.contains(container));
//console.log(container);
console.log('here')

container.id = "three-root";
document.body.prepend(container);

container.style.position = "fixed";
container.style.top = "0";
container.style.left = "0";
container.style.width = "100vw";
container.style.height = "100vh";
container.style.zIndex = "0";

//const container = document.getElementById('three-root');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75, container.clientWidth / container.clientHeight, 0.1, 1000
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
scene.add(mesh);

const controls = new OrbitControls( camera, renderer.domElement );

camera.position.set( 0, 5, 10 );
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



window.addEventListener('pointermove', function(){console.log('moving')})

animate();

