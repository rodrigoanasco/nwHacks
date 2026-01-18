"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export default function CurrentQuestion({ searchParams }) {
  let difficulty = useSearchParams().get("difficulty");
  difficulty = difficulty?.charAt(0).toUpperCase() + difficulty?.slice(1);
  console.log(difficulty);

  const currentQuestionName = useParams().name;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentMount = containerRef.current;
      if (!currentMount) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        100,
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
      let model: THREE.Object3D | null = null;

      loader.load(
        `/${currentQuestionName}.glb`,
        function (gltf) {
          model = gltf.scene;
          scene.add(model);
        },
        function (xhr) {
          // progress (optional)
          // console.log((xhr.loaded / (xhr.total || 1)) * 100 + "% loaded");
        },
        function (error) {
          console.error("An error happened", error);
        },
      );

      camera.position.z = 5;
      let frameId = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        if (model) model.rotation.y += 0.005;
        renderer.render(scene, camera);
      };
      frameId = requestAnimationFrame(animate);

      // Render the scene and camera
      renderer.render(scene, camera);

      return () => {
        // stop animation
        if (frameId) cancelAnimationFrame(frameId);

        // remove model and dispose geometries/materials
        if (model) {
          scene.remove(model);
          model.traverse((child: any) => {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => {
                  if (m.map) m.map.dispose();
                  m.dispose();
                });
              } else {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
              }
            }
          });
        }

        // remove renderer DOM and dispose renderer/context
        try {
          if (
            renderer.domElement &&
            currentMount.contains(renderer.domElement)
          ) {
            currentMount.removeChild(renderer.domElement);
          }
        } catch (e) {
          // ignore
        }
        try {
          renderer.dispose();
          // @ts-ignore
          if (renderer.forceContextLoss) renderer.forceContextLoss();
        } catch (e) {
          // ignore
        }
      };
    }
  }, [currentQuestionName]);

  const [loadingInBlender, setLoadingInBlender] = useState<boolean>(false);
  const loadInBlenderCallback = async () => {
    setLoadingInBlender(true);
    const apiRequestBody = {
      name: currentQuestionName,
      userId: "default",
    };
    await fetch("/api/question", {
      method: "POST", // Specify the method
      headers: {
        "Content-Type": "application/json", // Indicate the content type
      },
      body: JSON.stringify(apiRequestBody),
    });
    toast.success("3D model has been loaded, open up blender please.");
    setLoadingInBlender(false);
  };

  return (
    <div className="flex flex-col max-w-min mx-auto justify-center h-screen items-center gap-4">
      <div>
        <p>
          <b>Name:</b> {currentQuestionName}
        </p>
        <p>
          <b>Difficulty:</b>{" "}
          {difficulty === "Easy" && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Easy
            </Badge>
          )}
          {difficulty === "Medium" && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Medium
            </Badge>
          )}
          {difficulty === "Hard" && (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              Hard
            </Badge>
          )}
        </p>
      </div>
      <div ref={containerRef}></div>
      <Button className="w-full" onClick={loadInBlenderCallback}>
        {!loadingInBlender ? "Load in Blender" : "Loading..."}
      </Button>
    </div>
  );
}
