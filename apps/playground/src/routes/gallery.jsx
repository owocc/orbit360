import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import GalleryPage from "../components/GalleryPage";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
});
