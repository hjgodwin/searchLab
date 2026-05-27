import * as THREE from 'three'
/*
const scene = new THREE.Scene()
scene.background = new THREE.Color('rgb(245,245,245)');

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)


camera.position.z = 20;

const renderer = new THREE.WebGLRenderer({
  antialias: true
})


var mainDiv = document.querySelector('div.post-content.md-content');
var divWidth = mainDiv.offsetWidth;

renderer.setSize(divWidth, 500)

document
  .getElementById('three-root')
  .appendChild(renderer.domElement)
 */


//mport * as THREE from 'three';


// ATTEMPT A


// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('rgb(245,245,245)');

// Container / canvas sizing
const container = document.querySelector('div.post-content.md-content');

const width = container.clientWidth;
const height = 500;

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  width / height,
  0.1,
  1000
);

camera.position.z = 20;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);

//container.appendChild(renderer.domElement);

document
  .getElementById('three-root')
  .appendChild(renderer.domElement)

// Cubes
const cubes = [];
const velocities = [];

const cubeSize = 2;
const cubeCount = 8;

const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

const material = new THREE.MeshStandardMaterial({
  color: 0xff1493 // hot pink
});

// Visible bounds based on camera
const visibleHeight =
  2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;

const visibleWidth = visibleHeight * camera.aspect;

const bounds = {
  x: visibleWidth / 2 - cubeSize / 2,
  y: visibleHeight / 2 - cubeSize / 2
};

// Create cubes
for (let i = 0; i < cubeCount; i++) {
  const cube = new THREE.Mesh(geometry, material);

  cube.position.set(
    (Math.random() - 0.5) * bounds.x * 1.5,
    (Math.random() - 0.5) * bounds.y * 1.5,
    0
  );

  scene.add(cube);
  cubes.push(cube);

  velocities.push(
    new THREE.Vector3(
      (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.12,
      0
    )
  );
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 10);
scene.add(directionalLight);

// Animation
function animate() {
  requestAnimationFrame(animate);

  // Move cubes
  for (let i = 0; i < cubes.length; i++) {
    const cube = cubes[i];
    const velocity = velocities[i];

    cube.position.add(velocity);

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    // Bounce off canvas edges
    if (cube.position.x >= bounds.x || cube.position.x <= -bounds.x) {
      velocity.x *= -1;
    }

    if (cube.position.y >= bounds.y || cube.position.y <= -bounds.y) {
      velocity.y *= -1;
    }
  }

  // Cube collisions
  for (let i = 0; i < cubes.length; i++) {
    for (let j = i + 1; j < cubes.length; j++) {
      const a = cubes[i];
      const b = cubes[j];

      const distance = a.position.distanceTo(b.position);

      if (distance < cubeSize) {
        // Simple velocity swap
        const temp = velocities[i].clone();
        velocities[i].copy(velocities[j]);
        velocities[j].copy(temp);
      }
    }
  }

  renderer.render(scene, camera);
}

animate();

// Resize handling
window.addEventListener('resize', () => {
  const newWidth = container.clientWidth;

  camera.aspect = newWidth / height;
  camera.updateProjectionMatrix();

  renderer.setSize(newWidth, height);
})
/*
// ATTEMPT B

import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('rgb(245,245,245)');

// Container
const container = document.querySelector('div.post-content.md-content');

const width = container.clientWidth;
const height = 500;

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  width / height,
  0.1,
  1000
);

camera.position.z = 20;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);

//container.appendChild(renderer.domElement);


document
  .getElementById('three-root')
  .appendChild(renderer.domElement)
 

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 10);
scene.add(directionalLight);

// Bounds
const visibleHeight =
  2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;

const visibleWidth = visibleHeight * camera.aspect;

const bounds = {
  x: visibleWidth / 2,
  y: visibleHeight / 2
};

// Cubes
const cubes = [];
const cubeVelocities = [];

const cubeSize = 1.8;
const cubeCount = 4;

const cubeGeometry = new THREE.BoxGeometry(
  cubeSize,
  cubeSize,
  cubeSize
);

const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0xff1493
});

// Create cubes
for (let i = 0; i < cubeCount; i++) {
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

  cube.position.set(
    (Math.random() - 0.5) * bounds.x * 1.5,
    (Math.random() - 0.5) * bounds.y * 1.5,
    0
  );

  scene.add(cube);
  cubes.push(cube);

  cubeVelocities.push(
    new THREE.Vector3(
      (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.12,
      0
    )
  );
}

// Letters
const letters = [];
const letterVelocities = [];

const loader = new FontLoader();

loader.load(
  'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
  (font) => {
    const text = 'Search Lab';
    const spacing = 3;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      const geometry = new TextGeometry(char, {
        font: font,
        size: 3,
        depth: 0.3,
        curveSegments: 12,
        bevelEnabled: false
      });

      geometry.center();

      const material = new THREE.MeshStandardMaterial({
        color: 0x111111
      });

      const letterMesh = new THREE.Mesh(
        geometry,
        material
      );

      // Center the whole word
      const totalWidth = text.length * spacing;

      letterMesh.position.set(
        i * spacing - totalWidth / 2 + spacing / 2,
        0,
        0
      );

      scene.add(letterMesh);

      letters.push(letterMesh);

      // Initially stationary
      letterVelocities.push(
        new THREE.Vector3(0, 0, 0)
      );
    }
  }
);

// Animation
function animate() {
  requestAnimationFrame(animate);

  // Move cubes
  for (let i = 0; i < cubes.length; i++) {
    const cube = cubes[i];
    const velocity = cubeVelocities[i];

    cube.position.add(velocity);

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    // Bounce off walls
    if (
      cube.position.x > bounds.x - cubeSize / 2 ||
      cube.position.x < -bounds.x + cubeSize / 2
    ) {
      velocity.x *= -1;
    }

    if (
      cube.position.y > bounds.y - cubeSize / 2 ||
      cube.position.y < -bounds.y + cubeSize / 2
    ) {
      velocity.y *= -1;
    }
  }

  // Cube-cube collisions
  for (let i = 0; i < cubes.length; i++) {
    for (let j = i + 1; j < cubes.length; j++) {
      const a = cubes[i];
      const b = cubes[j];

      const distance = a.position.distanceTo(b.position);

      if (distance < cubeSize) {
        const temp = cubeVelocities[i].clone();

        cubeVelocities[i].copy(cubeVelocities[j]);
        cubeVelocities[j].copy(temp);
      }
    }
  }

  // Cube-letter collisions
  for (let i = 0; i < cubes.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      const cube = cubes[i];
      const letter = letters[j];

      const distance = cube.position.distanceTo(
        letter.position
      );

      if (distance < 1.5) {
        // Knock letter away
        const direction = new THREE.Vector3()
          .subVectors(letter.position, cube.position)
          .normalize();

        letterVelocities[j].add(
          direction.multiplyScalar(0.08)
        );
      }
    }
  }

  // Move letters
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const velocity = letterVelocities[i];

    letter.position.add(velocity);

    // Slight damping
    velocity.multiplyScalar(0.995);

    // Rotate slightly
    letter.rotation.z += velocity.x * 0.02;

    // Wall collisions
    if (
      letter.position.x > bounds.x - 1 ||
      letter.position.x < -bounds.x + 1
    ) {
      velocity.x *= -1;
    }

    if (
      letter.position.y > bounds.y - 1 ||
      letter.position.y < -bounds.y + 1
    ) {
      velocity.y *= -1;
    }
  }

  // Letter-letter collisions
  for (let i = 0; i < letters.length; i++) {
    for (let j = i + 1; j < letters.length; j++) {
      const a = letters[i];
      const b = letters[j];

      const distance = a.position.distanceTo(b.position);

      if (distance < 1) {
        const temp = letterVelocities[i].clone();

        letterVelocities[i].copy(letterVelocities[j]);
        letterVelocities[j].copy(temp);
      }
    }
  }

  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener('resize', () => {
  const newWidth = container.clientWidth;

  camera.aspect = newWidth / height;
  camera.updateProjectionMatrix();

  renderer.setSize(newWidth, height);
});

*/