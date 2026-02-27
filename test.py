import requests
import httpx
import re
import time
from urllib.parse import urlparse

def extract_val(html, pattern):
    m = re.search(pattern, html, re.S)
    if m: return m.group(1)
    alt = pattern.replace('"', "'")
    m = re.search(alt, html, re.S)
    if m: return m.group(1)
    return ""

def bypass_vshort_hybrid(url):
    print(f"Starting hybrid requests->httpx HTTP/2 bypass for: {url}")
    t0 = time.time()

    parsed = urlparse(url)
    link_id = parsed.path.strip('/')
    if not link_id:
        print("Invalid URL")
        return None

    # 1) Warm up with requests (your working path)
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
        "Connection": "keep-alive",
    })

    try:
        step1 = f"https://www.2short.club/?link={link_id}"
        step4 = f"https://finance.vshort.xyz/?link={link_id}"
        step5 = f"https://vshort.xyz/{link_id}"

        s.get("https://vshort.xyz/", timeout=8)                 # root
        s.get(step1, headers={"Referer": url}, timeout=8)      # 2short
        r5 = s.get(step5, headers={"Referer": step4}, timeout=8)  # landing

        html = r5.text

        _csrfToken = extract_val(html, r'name="_csrfToken".*?value="([^"]+)"')
        ad_form_data = extract_val(html, r'name="ad_form_data".*?value="([^"]+)"')
        if not ad_form_data:
            m = re.search(r"ad_form_data\s*[:=]\s*['\"]([^'\"]+)['\"]", html, re.S)
            if m: ad_form_data = m.group(1)
        token_fields = extract_val(html, r'name="_Token\[fields\]".*?value="([^"]+)"')
        token_unlocked = extract_val(html, r'name="_Token\[unlocked\]".*?value="([^"]+)"')

        if not ad_form_data:
            print("❌ ad_form_data not found — aborting.")
            return None

        payload = {
            "_method": "POST",
            "_csrfToken": _csrfToken,
            "ad_form_data": ad_form_data,
            "_Token[fields]": token_fields,
            "_Token[unlocked]": token_unlocked,
        }

        # Build headers for the POST (stringify referer)
        post_headers = {
            "Origin": "https://vshort.xyz",
            "Referer": str(r5.url),
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            # keep same UA
            "User-Agent": s.headers["User-Agent"],
        }

        # 2) Convert cookies from requests.Session to dict for httpx
        cookie_dict = requests.utils.dict_from_cookiejar(s.cookies)

        # 3) Use httpx HTTP/2 client for the final POST
        with httpx.Client(http2=True, headers={"User-Agent": s.headers["User-Agent"]}, cookies=cookie_dict, timeout=15.0) as client:
            # perform the POST using httpx (HTTP/2)
            resp = client.post("https://vshort.xyz/links/go", data=payload, headers=post_headers)
            elapsed = time.time() - t0

            # try parse JSON
            try:
                j = resp.json()
            except Exception:
                print("❌ final response not JSON:", resp.text[:300])
                return None

            if isinstance(j, dict) and j.get("status") == "success":
                print("✅ SUCCESS:", j.get("url"))
                print(f"Total Time: {elapsed:.2f}s")
                return j.get("url")

            print("❌ Server returned:", j)
            print(f"Total Time: {elapsed:.2f}s")
            return None

    except Exception as e:
        print("❌ Exception:", e)
        return None

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "https://vshort.xyz/AieQ7fET"
    bypass_vshort_hybrid(target)