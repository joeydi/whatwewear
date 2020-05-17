import * as THREE from "three";

import Material from "./material";

import Config from "../../data/config";

// This helper class can be used to create and then place geometry in the scene
export default class Geometry {
  constructor(scene, material) {
    this.scene = scene;
    this.material = material ? material : Material(0xeeeeee).standard;
    this.geo = null;
    this.mesh = null;
  }

  make(type) {
    if (type === "plane") {
      return (width, height, widthSegments = 1, heightSegments = 1) => {
        this.geo = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
      };
    }

    if (type === "sphere") {
      return (radius, widthSegments = 32, heightSegments = 32) => {
        this.geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
      };
    }
  }

  place(position, rotation) {
    this.mesh = new THREE.Mesh(this.geo, this.material);

    // Use ES6 spread to set position and rotation from passed in array
    this.mesh.position.set(...position);
    this.mesh.rotation.set(...rotation);

    if (Config.shadow.enabled) {
      this.mesh.receiveShadow = true;
    }

    this.scene.add(this.mesh);
  }
}
