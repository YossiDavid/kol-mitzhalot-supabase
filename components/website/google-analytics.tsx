import { GoogleAnalytics } from "@next/third-parties/google";

export default function Analytics() {
  return <GoogleAnalytics gaId={`${process.env.GOOGLE_ANALYTICS_GAID}`} />;
}
