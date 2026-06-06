
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';


const scene = new THREE.Scene();
scene.background = new THREE.Color("rgb(245,245,245)");
const container = document.querySelector("div.post-content.md-content");
const width = container.clientWidth;
const height = 500//container.clientHeight;
let requestID

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor("#ffffff");

const camera = new THREE.PerspectiveCamera( 10, width / height, 0.75, 1000 );
camera.position.z = 20;
document.getElementById("three-root").appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight( 0xffffff, 0.8 );
scene.add(ambientLight)

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshStandardMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

let controls = new OrbitControls(camera, renderer.domElement);
animate()

function animate() {
    requestID = requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// 