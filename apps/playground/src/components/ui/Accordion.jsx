import * as React from "react";
import { Accordion as BaseAccordion } from "@base-ui/react";

export function Accordion({ defaultValue, value, onValueChange, className = "", children }) {
  return (
    <BaseAccordion.Root
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={`divide-y divide-neutral-800 border-y border-neutral-800 ${className}`}
    >
      {children}
    </BaseAccordion.Root>
  );
}

export function AccordionItem({ value, className = "", children }) {
  return (
    <BaseAccordion.Item value={value} className={`overflow-hidden ${className}`}>
      {children}
    </BaseAccordion.Item>
  );
}

export function AccordionTrigger({ className = "", children }) {
  return (
    <BaseAccordion.Header className="flex">
      <BaseAccordion.Trigger
        className={`flex flex-1 items-center justify-between py-4 text-left font-mono text-sm font-medium transition-all text-neutral-300 hover:text-white group [&[data-expanded]>span.indicator]:rotate-45 ${className}`}
      >
        <span>{children}</span>
        <span className="indicator inline-block font-mono text-xs text-neutral-500 transition-transform duration-200">
          +
        </span>
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  );
}

export function AccordionPanel({ className = "", children }) {
  return (
    <BaseAccordion.Panel
      className={`pb-4 pt-0 text-xs text-neutral-400 leading-relaxed font-sans ${className}`}
    >
      {children}
    </BaseAccordion.Panel>
  );
}
