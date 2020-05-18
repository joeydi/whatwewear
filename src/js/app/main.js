// Global imports -
import * as THREE from "three";
import TWEEN from "tween.js";
import { gsap } from "gsap";

// Local imports -
// Components
import Renderer from "./components/renderer";
import Camera from "./components/camera";
import Light from "./components/light";
import Controls from "./components/controls";

// Helpers
import Geometry from "./helpers/geometry";
import Stats from "./helpers/stats";
import Helpers from "../utils/helpers";

// Model
// import Texture from "./model/texture";
// import Model from "./model/model";

// Managers
import Interaction from "./managers/interaction";
import DatGUI from "./managers/datGUI";

// data
import Config from "./../data/config";
// -- End of imports

// This class instantiates and ties all of the components together, starts the loading process and renders the main loop
export default class Main {
  constructor(container) {
    // Set container property to container element
    this.container = container;

    // Start Three clock
    this.clock = new THREE.Clock();

    // Main scene creation
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(Config.fog.color, Config.fog.near);

    // Get Device Pixel Ratio first for retina
    if (window.devicePixelRatio) {
      Config.dpr = window.devicePixelRatio;
    }

    // Main renderer constructor
    this.renderer = new Renderer(this.scene, container);

    // Components instantiations
    this.camera = new Camera(this.renderer.threeRenderer);
    this.controls = new Controls(this.camera.threeCamera, container);
    this.light = new Light(this.scene);

    // Create and place lights in scene
    const lights = ["ambient", "directional", "point", "hemi"];
    lights.forEach((light) => this.light.place(light));

    // Set up rStats if dev environment
    if (Config.isDev && Config.isShowingStats) {
      this.stats = new Stats(this.renderer);
      this.stats.setUp();
    }

    const video = (this.video = document.createElement("video"));
    this.video.muted = true;
    this.video.loop = true;
    this.video.src = Config.videoSrc;
    this.video.load(); // must call after setting/changing source
    this.video.play();

    const videoImage = document.createElement("canvas");
    videoImage.width = 1280;
    videoImage.height = 720;

    this.videoImageContext = videoImage.getContext("2d");
    this.videoImageContext.fillStyle = "#000000";
    this.videoImageContext.fillRect(0, 0, videoImage.width, videoImage.height);

    this.videoTexture = new THREE.Texture(videoImage);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    this.planes = [];
    const planeCount = 100;
    const screenWidth = 30;
    const screenHeight = 20;
    const bottomDiameter = 100;
    const MidDiameter = 50;
    const TopDiameter = 60;
    const height = 250;

    const tweenObj = { diameter: bottomDiameter };
    const diameterTween = gsap.timeline().pause();
    diameterTween.to(tweenObj, 1, { diameter: MidDiameter });
    diameterTween.to(tweenObj, 0.25, { diameter: TopDiameter });

    for (let i = 0; i < planeCount; i += 1) {
      // Modify the videoTexture to align to this plane
      const planeTexture = this.videoTexture.clone();
      planeTexture.repeat.x = 0.1;
      planeTexture.repeat.y = 0.1;
      planeTexture.offset.x = 0.1 * (i % 10);
      planeTexture.offset.y = Math.floor(0.01 * i * 10) / 10;

      const planeMaterial = new THREE.MeshBasicMaterial({
        map: planeTexture,
        side: THREE.DoubleSide,
      });

      // Create and place geo in scene
      this.planes[i] = new Geometry(this.scene, planeMaterial);
      this.planes[i].make("plane")(screenWidth, screenHeight, 10, 10);
      this.planes[i].place([0, 0, 0], [0, 0, 0]);

      // Create object to store our position keyframes
      this.planes[i].keyframes = {};

      // Store the texture so we can call texture.needsUpdate in the render loop
      this.planes[i].texture = planeTexture;

      // Calculate the position for the dress

      const rotationFactor = 0.63;
      const progress = Helpers.convertRange(i, [0, planeCount], [0, 1]);

      diameterTween.progress(progress);

      // X and Y use sin and cos to loop around the center
      const positionX = -Math.sin(i * rotationFactor) * tweenObj.diameter;
      const positionZ = -Math.cos(i * rotationFactor) * tweenObj.diameter;

      // Y gets centered around 0 based on height
      const positionY = Helpers.convertRange(i, [0, planeCount], [-height / 2, height / 2]);

      const planeVector = new THREE.Vector3(
        positionX,
        THREE.MathUtils.lerp(0, -positionY, 0.25),
        positionZ
      );
      this.planes[i].mesh.up = new THREE.Vector3(0, 1, 0);
      this.planes[i].mesh.lookAt(planeVector);

      const dressPosition = new THREE.Vector3(positionX, positionY, positionZ);

      this.planes[i].keyframes.dress = {
        position: dressPosition,
        rotation: this.planes[i].mesh.rotation.clone(),
      };

      // Calculate the position for the grid
      const gridPositionX = (i % 10) * screenWidth - screenWidth * 5;
      const gridPositionY = Math.floor(i / 10) * screenHeight - screenHeight * 5;

      this.planes[i].keyframes.grid = {
        position: new THREE.Vector3(gridPositionX, gridPositionY, 0),
        rotation: new THREE.Euler(0, 0, 0),
      };

      this.planes[i].mesh.position.set(gridPositionX, gridPositionY, 0);
      this.planes[i].mesh.rotation.set(0, 0, 0);
    }

    this.container.querySelector("#loading").style.display = "none";

    this.container.addEventListener("click", (e) => {
      Config.arrangement = Config.arrangement == "dress" ? "grid" : "dress";
      this.updateArrangement(Config.arrangement);
    });

    new Interaction(
      this.renderer.threeRenderer,
      this.scene,
      this.camera.threeCamera,
      this.controls.threeControls
    );

    // Add dat.GUI controls if dev
    if (Config.isDev) {
      new DatGUI(this);
    }

    // Start render which does not wait for model fully loaded
    this.render();
  }

  updateArrangement(arrangement) {
    const duration = 2;

    this.planes.forEach((plane, i) => {
      gsap.to(plane.mesh.position, duration, {
        x: plane.keyframes[arrangement].position.x,
        y: plane.keyframes[arrangement].position.y,
        z: plane.keyframes[arrangement].position.z,
        ease: arrangement == "dress" ? "elastic.out" : "expo.out",
        delay: 0.005 * i,
      });

      gsap.to(plane.mesh.rotation, duration, {
        x: plane.keyframes[arrangement].rotation.x,
        y: plane.keyframes[arrangement].rotation.y,
        z: plane.keyframes[arrangement].rotation.z,
        ease: "expo.out",
      });
    });
  }

  render() {
    // Render rStats if Dev
    if (Config.isDev && Config.isShowingStats) {
      Stats.start();
    }

    // Call render function and pass in created scene and camera
    this.renderer.render(this.scene, this.camera.threeCamera);

    // rStats has finished determining render call now
    if (Config.isDev && Config.isShowingStats) {
      Stats.end();
    }

    // Delta time is sometimes needed for certain updates
    //const delta = this.clock.getDelta();

    // Call any vendor or module frame updates here
    TWEEN.update();
    this.controls.threeControls.update();

    this.videoImageContext.drawImage(this.video, 0, 0);
    if (this.videoTexture) {
      this.videoTexture.needsUpdate = true;
    }

    this.planes.forEach((plane) => {
      plane.texture.needsUpdate = true;
    });

    // RAF
    requestAnimationFrame(this.render.bind(this)); // Bind the main class instead of window object
  }
}
