import Demo from "@/components/demo/Demo";
import Hero from "@/components/sections/Hero";
import Nav from "@/components/sections/Nav";
import { Character, Comparison, Footer, Helps, Partners, Problem } from "@/components/sections/Story";
import { SectionHead } from "@/components/sections/ui";

export default function Home() {
  return (
    <main className="overflow-x-clip">
      <Nav />
      <Hero />
      <Problem />
      <Helps />
      <Comparison />

      <section id="demo" className="relative scroll-mt-20 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-100 via-lilac-100 to-sky-100 opacity-70 blur-[110px]" />
        </div>
        <div className="container-lumi relative">
          <SectionHead
            eyebrow="Interaktiivinen demo"
            title="Kokeile Lumia itse."
            lead="Kirjoita mitä tahansa, niin kuin lapsi kirjoittaisi – myös väärä vastaus tai ”kerro vaan vastaus”. Oikea kielimalli muodostaa jokaisen vastauksen, ja Lumin pedagoginen ohjauskerros pitää huolen, että ajattelu jää lapselle."
          />
          <div className="mx-auto mt-12 max-w-5xl">
            <Demo />
          </div>
        </div>
      </section>

      <Character />
      <Partners />
      <Footer />
    </main>
  );
}
