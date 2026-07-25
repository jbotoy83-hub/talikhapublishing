import { CONTACT_EMAIL } from "@/lib/site";

export function HomeNewsletter() {
  return <div><p className="text-sm leading-7 text-white/80">Newsletter enrollment is intentionally disabled until a consent-aware email provider and unsubscribe workflow are connected.</p><a href={`mailto:${CONTACT_EMAIL}`} className="dispatch-button mt-4 inline-flex rounded-xl px-5 py-3 text-sm font-bold">Contact the editorial team</a></div>;
}
