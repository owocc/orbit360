import React from "react";
import { HeroCardStack } from "./HeroCardStack";
import { ShowcaseSections } from "./ShowcaseSections";

export function IndexHome() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <HeroCardStack />
      <ShowcaseSections />
    </div>
  );
}
