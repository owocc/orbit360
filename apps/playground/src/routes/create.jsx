import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import CreatePage from "../components/CreatePage";

export const Route = createFileRoute("/create")({
  component: CreatePage,
});
