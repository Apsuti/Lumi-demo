"use client";

import { prepareImage, type PreparedImage } from "../demo/image";
import { debugEvent } from "../demo/voiceLog";

/**
 * Takes one photo with the back camera and closes the camera straight away.
 * Nothing is stored: the picture exists only in memory until it has been sent to Claude.
 */
export async function takePhoto(): Promise<PreparedImage> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  try {
    video.srcObject = stream;
    await video.play();
    if (!video.videoWidth) await new Promise((r) => video.addEventListener("loadeddata", r, { once: true }));
    // Give auto-exposure and focus a moment.
    await new Promise((r) => setTimeout(r, 600));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    stopAll(stream, video);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("capture"))), "image/jpeg", 0.92));
    canvas.width = canvas.height = 0; // release the pixels
    return await prepareImage(blob);
  } finally {
    stopAll(stream, video);
  }
}

function stopAll(stream: MediaStream, video: HTMLVideoElement) {
  if (stream.getTracks().some((t) => t.readyState === "live")) debugEvent("Kamera suljettu");
  stream.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
}
