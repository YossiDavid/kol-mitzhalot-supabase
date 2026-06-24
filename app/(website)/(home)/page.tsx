import Section from "@/components/layout/section";
import { Star } from "lucide-react";
import Logo from "@/assets/images/logo.svg"
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  if (params.token_hash) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([k]) =>
          ["token_hash", "type", "next", "code"].includes(k),
        ),
      ),
    ).toString();
    redirect(`/auth/confirm?${qs}`);
  }
  return (
    <Section containerClassName="py-16 md:py-24">
      <div className="mx-auto max-w-4xl text-center space-y-12">
        {/* Icon with animation */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
            {/* <div className="relative bg-primary/10 p-6 rounded-full border border-primary/20"> */}
            {/* <Sparkles className="size-12 text-primary animate-pulse" /> */}
            <Image src={Logo.src} alt="logo" width={50} height={100} />
            {/* </div> */}
          </div>
        </div>

        {/* Main heading */}
        <div className="space-y-6">
          <h1 className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            קול מצהלות
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            אתר התדמית החדש שלנו בדרך אליכם
          </p>
        </div>

        {/* Description with icons */}
        <div className="mx-auto max-w-2xl space-y-6">
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            אנחנו עובדים על משהו מיוחד במיוחד.
            <br />
            <span className="font-semibold text-foreground inline-flex items-center gap-2">
              שווה לחכות!
              {/* <Heart className="w-5 h-5 text-primary fill-primary animate-pulse" /> */}
            </span>
          </p>

          <Button asChild>
            <Link href="/app">לדף הבית של המערכת</Link>
          </Button>

          {/* Decorative elements */}
          <div className="flex justify-center items-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <Star className="size-5 text-primary fill-primary/30 animate-pulse delay-75" />
            <Star className="size-6 text-primary fill-primary/50 animate-pulse delay-150" />
            <Star className="size-5 text-primary fill-primary/30 animate-pulse delay-300" />
          </div>

        </div>
      </div>
    </Section>
  );
}
