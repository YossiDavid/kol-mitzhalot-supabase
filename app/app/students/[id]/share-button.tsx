"use client";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

export default function ShareButton() {
  return (
    <Button
      variant="outline"
      onClick={() => {
        console.log("Clicked share button");
      }}
    >
      שיתוף הכרטיס
      <Share2 />
    </Button>
  );
}
