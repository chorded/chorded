import NavBar from "@/components/NavBar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import MoreFeatures from "@/components/MoreFeatures";
import VideoPitch from "@/components/VideoPitch";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <NavBar />
      <main className="flex-grow flex flex-col">
        <Hero />
        <Features />
        <MoreFeatures />
        <VideoPitch />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
