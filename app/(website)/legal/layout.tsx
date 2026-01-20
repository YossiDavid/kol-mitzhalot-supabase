import React from "react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
	return (
		<article className="prose prose-lg max-w-[1000px] mx-auto text-justify! py-8 [&_p]:mt-0 [&_p]:mb-2 [&_ul]:list-outside [&_ol]:list-outside [&_li]:ml-0 [&_h1]:mt-0 [&_h1]:mb-4 [&_h2]:mt-6 [&_h2]:mb-4 [&_h3]:mt-4 [&_h3]:mb-3 [&_h4]:mt-4 [&_h4]:mb-2 [&_h5]:mt-3 [&_h5]:mb-2 [&_h6]:mt-2 [&_h6]:mb-2">
			{children}
		</article>
	);
}