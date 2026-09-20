import { CONSENT_STORAGE_KEY } from "@/lib/analytics";

// Google Consent Mode v2 defaults. This must run BEFORE the GTM snippet, so
// it is inlined as a blocking script in <head> — same approach as ThemeScript.
//
// Everything starts denied. Google's tags still load but buffer instead of
// writing cookies or sending identifiers until the visitor accepts.
//
// The advertising signals are denied here and never granted anywhere in the
// app: we run no ad products, and the privacy policy promises we don't share
// with advertisers. Only analytics_storage is ever flipped, and only by an
// explicit click in the consent banner.
export default function ConsentDefaults() {
  const js = `(function(){
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
gtag('consent','default',{
'ad_storage':'denied',
'ad_user_data':'denied',
'ad_personalization':'denied',
'analytics_storage':'denied',
'functionality_storage':'granted',
'security_storage':'granted',
'wait_for_update':500
});
try{
if(localStorage.getItem('${CONSENT_STORAGE_KEY}')==='granted'){
gtag('consent','update',{'analytics_storage':'granted'});
}
}catch(e){}
})();`;
  return (
    <script id="consent-defaults" dangerouslySetInnerHTML={{ __html: js }} />
  );
}
