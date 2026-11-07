import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import GalleryPage from "../components/GalleryPage";
import { getOrbsPage } from "../server/orb-functions.js";

export const Route = createFileRoute("/gallery")({
  loader: () => getOrbsPage({ data: { cursor: null } }),
  component: GalleryPage,
});
