import Demo from "@/components/demo/Demo";
import LumiCharacter from "@/components/LumiCharacter";

export default function Home() {
  return (
    <main className="min-h-svh bg-gradient-to-br from-sky-50 via-white to-lilac-50 px-2 py-2 sm:px-6 sm:py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 flex items-center gap-2 pl-2 sm:mb-3">
          <LumiCharacter size={28} float={false} />
          <span className="font-display text-lg font-extrabold">Lumi</span>
          <span className="ml-1 rounded-full bg-lilac-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lilac-600">Testiversio</span>
        </div>
        <Demo />
      </div>
    </main>
  );
}
