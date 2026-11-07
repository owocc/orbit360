import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import GalleryPage from "../components/GalleryPage";
import { listOrbs } from "../server/orbs.server.js";

const getOrbs = createServerFn({ method: "GET" }).handler(() => listOrbs());

export const Route = createFileRoute("/gallery")({
  loader: () => getOrbs(),
  component: GalleryPage,
});
