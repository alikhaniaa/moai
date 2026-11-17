import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import CustomCursor from "@/components/CustomCursor";
import Preloader from "@/components/Preloader";
import MobileTabBar from "@/components/MobileTabBar";
import VisitTracker from "@/components/VisitTracker";
import NoticePopup from "@/components/NoticePopup";
import ContactWidget from "@/components/ContactWidget";
import { getSessionUser } from "@/lib/auth";
import { getSettings, popupNotice, contactChannels } from "@/lib/settings";
import { appearanceVariables, eventBanner, getAppearance } from "@/lib/appearance";
import type { CSSProperties } from "react";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([getSessionUser(), getSettings()]);
  const notice = popupNotice(settings);
  const channels = contactChannels(settings);
  const appearance = getAppearance(settings);

  return (
    <div data-storefront className="min-h-svh bg-sand-50" style={appearanceVariables(appearance) as CSSProperties}>
      <Preloader />
      <CustomCursor />
      <VisitTracker />
      <Navbar loggedIn={!!user} announcement={settings.announcement} event={eventBanner(appearance)} />
      <main>{children}</main>
      <Footer settings={settings} />
      <CartDrawer />
      <MobileTabBar />
      {notice && <NoticePopup notice={notice} />}

      <ContactWidget
        title={settings.contactTitle}
        subtitle={settings.contactSubtitle}
        channels={channels}
      />
    </div>
  );
}
