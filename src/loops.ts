import { v4 as uuidv4 } from "uuid";
import type { LampLoop, LoopSection, LoopStep } from "./types";

const DEFAULT_HOLD_MS = 2000;
const DEFAULT_TRANSITION_MS = 1200;

function step(
  name: string,
  r: number,
  g: number,
  b: number,
  brightness = 64,
  holdMs = DEFAULT_HOLD_MS,
  transitionToNextMs = DEFAULT_TRANSITION_MS
): Omit<LoopStep, "id"> {
  return {
    name,
    r,
    g,
    b,
    brightness,
    holdMs,
    transitionToNextMs,
    transitionType: "smooth",
  };
}

function makeStep(fields: Omit<LoopStep, "id">): LoopStep {
  return { ...fields, id: uuidv4() };
}

function makeLoop(
  name: string,
  sectionId: string,
  stepFields: Omit<LoopStep, "id">[],
  notes?: string
): LampLoop {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    sectionId,
    steps: stepFields.map((s) => makeStep(s)),
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

export function makeLoopSection(name: string): LoopSection {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    collapsed: false,
    loopIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const DEFAULT_LOOP_SECTION_NAME = "My Loops";

export function getDefaultLoopSectionId(sections: LoopSection[]): string {
  return (
    sections.find((s) => s.name === DEFAULT_LOOP_SECTION_NAME)?.id ??
    sections[0]?.id ??
    ""
  );
}

export function ensureDefaultLoopSections(sections: LoopSection[]): LoopSection[] {
  if (sections.length === 0) {
    return [makeLoopSection(DEFAULT_LOOP_SECTION_NAME)];
  }
  if (!sections.some((s) => s.name === DEFAULT_LOOP_SECTION_NAME)) {
    return [makeLoopSection(DEFAULT_LOOP_SECTION_NAME), ...sections];
  }
  return sections;
}

export function seedLoopDefaults(): { loops: LampLoop[]; loopSections: LoopSection[] } {
  const mine = makeLoopSection(DEFAULT_LOOP_SECTION_NAME);
  const starter = makeLoopSection("Starter Loops");

  const loops = [
    makeLoop("Soft Sunset Drift", starter.id, [
      step("Orange Sunset", 255, 128, 0),
      step("Dark Orange", 255, 80, 10),
      step("Reddish Orange", 255, 40, 0),
      step("Orange Sunset", 255, 128, 0),
    ], "Gentle warm sunset drift"),
    makeLoop("Ocean Pulse", starter.id, [
      step("Blue", 0, 0, 255),
      step("Ocean Blue-Green", 0, 150, 200),
      step("Blue Green Border", 0, 255, 255),
      step("Blue", 0, 0, 255),
    ], "Cool ocean color pulse"),
    makeLoop("Pink Glow", starter.id, [
      step("Pink Purple", 255, 0, 255),
      step("Pink Yellow Border", 255, 255, 255),
      step("Pink Purple", 255, 0, 255),
    ], "Soft pink glow cycle"),
  ];

  starter.loopIds = loops.map((l) => l.id);

  return { loops, loopSections: [mine, starter] };
}

export function makeEmptyStep(): LoopStep {
  return makeStep(step("New Step", 255, 128, 0));
}

export function duplicateLoop(loop: LampLoop, sectionId?: string): LampLoop {
  const now = new Date().toISOString();
  return {
    ...loop,
    id: uuidv4(),
    name: `${loop.name} Copy`,
    sectionId: sectionId ?? loop.sectionId,
    steps: loop.steps.map((s) => ({ ...s, id: uuidv4() })),
    createdAt: now,
    updatedAt: now,
  };
}
