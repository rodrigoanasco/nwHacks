"use client";

import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export default function CurrentQuestion() {
  const currentQuestionName = useParams().name;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== undefined) {
      const currentMount = containerRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth / 2, window.innerHeight / 2);
      currentMount.appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const directionalLightOne = new THREE.DirectionalLight(0xffffff, 1);
      directionalLightOne.position.set(5, 10, 7.5);
      const directionalLightTwo = new THREE.DirectionalLight(0xffffff, 1);
      directionalLightTwo.position.set(-5, 0, 0);
      scene.add(directionalLightOne);
      scene.add(directionalLightTwo);

      const loader = new GLTFLoader();

      loader.load(
        // resource URL
        "/easy.glb",
        // called when the resource is loaded
        function (gltf) {
          scene.add(gltf.scene);
          // Optional: You can access animations, cameras, etc. here
          // const animations = gltf.animations;
          // const cameras = gltf.cameras;
        },
        // called while loading is progressing (optional)
        function (xhr) {
          console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        },
        // called when loading has errors (optional)
        function (error) {
          console.error("An error happened", error);
        },
      );

      camera.position.z = 5;
      const animate = () => {
        requestAnimationFrame(animate);
        // Optional: add some rotation
        console.log(scene.children);

        if (scene.children.length > 3) scene.children[3].rotation.y += 0.005;
        renderer.render(scene, camera);
      };
      animate();

      // Render the scene and camera
      renderer.render(scene, camera);

      return () => {
        currentMount.removeChild(renderer.domElement);
      };
    }
  }, []);

  const [loadingInBlender, setLoadingInBlender] = useState<boolean>(false);
  const loadInBlenderCallback = () => {};

  return (
    <div className="flex flex-col max-w-min mx-auto justify-center h-screen items-center gap-4">
      <div ref={containerRef}></div>
      <Button className="w-full" onClick={}>
        {!loadingInBlender ? "Load in Blender" : "Loading..."}
      </Button>
    </div>
  );
}
