import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shapes } from "lucide-react";

export default function Page() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="mb-8 flex justify-center">
          <div className="animate-float rounded-2xl bg-card p-4 shadow-elevated">
            <Shapes className="h-12 w-12 text-primary" />
          </div>
        </div>

        <h1 className="mb-4 text-5xl font-bold leading-tight tracking-tight text-foreground ">
          Practice 3D modeling.
        </h1>

        <p className="mx-auto mb-10 max-w-lg text-lg text-muted-foreground">
          Short, focused challenges to build real skills in Blender and 3D.
        </p>

        <Link href="/problems" className="inline-block">
          <Button size="lg" className="gap-2">
            View problems
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
