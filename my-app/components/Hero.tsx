import { Button } from "@/components/ui/button";
import { ArrowRight, Shapes } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        {/* Floating 3D shape decoration */}
        <div className="mb-8 flex justify-center">
          <div className="animate-float rounded-2xl bg-card p-4 shadow-elevated">
            <Shapes className="h-12 w-12 text-primary" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="mb-4 text-5xl font-bold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl">
          Practice 3D modeling.
          <br />
          <span className="text-primary">Level up.</span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mb-10 max-w-lg text-lg text-muted-foreground">
          Solve challenges, build skills, master Blender.
        </p>

        <Button size="lg" className="gap-2">
          Start practicing
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
