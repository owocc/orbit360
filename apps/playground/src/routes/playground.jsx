import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import PlaygroundPage from "../components/PlaygroundPage";

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
});
