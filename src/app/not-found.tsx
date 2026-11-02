import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-[48px] font-bold">404</p>
        <p className="text-label-2">This page doesn&apos;t exist.</p>
        <Link href="/" className={buttonClass("filled") + " mt-6"}>
          Go home
        </Link>
      </div>
    </main>
  );
}
