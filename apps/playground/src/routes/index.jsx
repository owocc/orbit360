import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IndexHome } from "../components/IndexHome";

export const Route = createFileRoute("/")({
  component: IndexHome,
});
