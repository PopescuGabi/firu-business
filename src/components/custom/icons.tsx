import {
  BookOpen, Briefcase, Calendar, Camera, Car, ChartColumn, Clock, Code, Cpu, Dumbbell, Film, FlaskConical, GraduationCap, Hammer, Heart,
  House, Kanban, Leaf, List, Map, Music, Package, Palette, PenLine, Plane, Ruler, Star, Stethoscope, Users, Utensils, Wallet, Wrench,
  type LucideIcon,
} from "lucide-react";
import type { PageIcon } from "@/lib/custom-pages";

/** Lucide icon for each allowed custom-page icon name. */
export const PAGE_ICON: Record<PageIcon, LucideIcon> = {
  briefcase: Briefcase, camera: Camera, wrench: Wrench, hammer: Hammer, ruler: Ruler, cpu: Cpu, code: Code, flask: FlaskConical,
  stethoscope: Stethoscope, book: BookOpen, pen: PenLine, palette: Palette, music: Music, film: Film, home: House, car: Car, plane: Plane,
  map: Map, calendar: Calendar, clock: Clock, list: List, kanban: Kanban, chart: ChartColumn, wallet: Wallet, package: Package,
  users: Users, heart: Heart, leaf: Leaf, utensils: Utensils, graduation: GraduationCap, dumbbell: Dumbbell, star: Star,
};

export const iconFor = (name: string): LucideIcon => PAGE_ICON[name as PageIcon] ?? List;
