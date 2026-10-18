import Link from "next/link";
import Demo from "@/components/demo/Demo";
import LumiCharacter from "@/components/LumiCharacter";

export const metadata = { title: "Lumi – Demo" };

export default function DemoPage() {
  return (
    <main className="min-h-svh bg-gradient-to-br from-sky-50 via-white to-lilac-50 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 pl-1">
          <LumiCharacter size={30} float={false} />
          <span className="font-display text-lg font-extrabold">Lumi</span>
        </Link>
        <Demo startOpen />
      </div>
    </main>
  );
}
