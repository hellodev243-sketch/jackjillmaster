import type React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

export const metadata: Metadata = {
	title: "Jack & Jill Competition",
	description:
		"Professional dance competition management system for Jack & Jill events",
	generator: "Jack & Jill Competition System",
	icons: {
		icon: [
			{
				url: "/favicon.svg",
				type: "image/svg+xml",
			},
		],
		shortcut: "/favicon.svg",
		apple: "/favicon.svg",
	},
};

export const viewport: Viewport = {
	themeColor: "#1a1a2e",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
			<body className={`font-sans antialiased`}>
				{children}
				<Toaster
					position="top-right"
					richColors
					closeButton
					theme="dark"
				/>
			</body>
		</html>
	);
}
