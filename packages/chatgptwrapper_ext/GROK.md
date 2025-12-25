https://grok.com/rest/app-chat/conversations/new
{
    "temporary": false,
    "modelName": "grok-3",
    "message": "what is your prediction for 2026",
    "fileAttachments": [],
    "imageAttachments": [],
    "disableSearch": false,
    "enableImageGeneration": true,
    "returnImageBytes": false,
    "returnRawGrokInXaiRequest": false,
    "enableImageStreaming": true,
    "imageGenerationCount": 2,
    "forceConcise": false,
    "toolOverrides": {},
    "enableSideBySide": true,
    "sendFinalMetadata": true,
    "isReasoning": false,
    "disableTextFollowUps": false,
    "responseMetadata": {
        "modelConfigOverride": {
            "modelMap": {}
        },
        "requestModelDetails": {
            "modelId": "grok-3"
        }
    },
    "disableMemory": false,
    "forceSideBySide": false,
    "modelMode": "MODEL_MODE_FAST",
    "isAsyncChat": false,
    "disableSelfHarmShortCircuit": false,
    "collectionIds": [],
    "deviceEnvInfo": {
        "darkModeEnabled": false,
        "devicePixelRatio": 2,
        "screenWidth": 1920,
        "screenHeight": 804,
        "viewportWidth": 645,
        "viewportHeight": 648
    }
}




Request URL
https://grok.com/rest/app-chat/conversations/new
Request Method
POST
Status Code
200 OK
Remote Address
[2606:4700::6812:1dea]:443
Referrer Policy
origin-when-cross-origin
alt-svc
h3=":443"; ma=86400
cf-cache-status
DYNAMIC
cf-ray
9b398943e9c4e75f-DEN
content-encoding
gzip
content-type
application/json
date
Thu, 25 Dec 2025 15:57:47 GMT
priority
u=1,i
server
cloudflare
server-timing
cfExtPri
strict-transport-security
max-age=31536000; includeSubDomains
vary
Origin, origin, access-control-request-method, access-control-request-headers, Accept-Encoding
x-trace-id
aca457bd0ef37303bcda8f7977bc7d45
:authority
grok.com
:method
POST
:path
/rest/app-chat/conversations/new
:scheme
https
accept
*/*
accept-encoding
gzip, deflate, br, zstd
accept-language
en-US,en;q=0.9
baggage
sentry-environment=production,sentry-release=52d6084310cf0e11ba8d9e77aa389aaffda9328c,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=8b95cf520bbb239b16d3072dffa691c5,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.4590718284895936,sentry-sample_rate=0
content-length
824
content-type
application/json
cookie
_ga=GA1.1.834164499.1766676714; i18nextLng=en; x-anonuserid=bf8cfc32-5d39-4db9-acee-ebe1e45a5ab1; x-challenge=Vgm%2FhnG4WFb6pj8G1reJg6vK01tz2DrNHI2aXN5c%2Fovn1dNTjVECPfOufUoIsVl7y6r7x02c4oX7E1vVrhYc8UxU2VROV86p0s2u9ojXcubZgOXK3m%2F%2BqrVBWjKhZDhz%2B%2BTMSO99rbQmw5gQgt%2BrCcF6HC8kWKk7HArqH2EhAkjmj3Qr8SU%3D; x-signature=VVu0UY0RSIPhe01eM49mUmnSWPiYGxuUJ4KJD4LGHWAeOfa7gXVI2wkOKInrcO6gTvxkVsft6NTeakDO6%2Bi%2Fuw%3D%3D; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiNzRiZmViMzctM2Q3Ni00NTcxLTkwZmEtNDMyMjVkMmFlMDExIn0.eHPg9-1IA4vaXHWrubWVd0TNpV1CvS0ohcBJwjKehfg; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiNzRiZmViMzctM2Q3Ni00NTcxLTkwZmEtNDMyMjVkMmFlMDExIn0.eHPg9-1IA4vaXHWrubWVd0TNpV1CvS0ohcBJwjKehfg; x-userid=e23c1529-6f7b-4d4e-8dc7-e0838cf877cc; mp_ea93da913ddb66b6372b89d97b1029ac_mixpanel=%7B%22distinct_id%22%3A%22e23c1529-6f7b-4d4e-8dc7-e0838cf877cc%22%2C%22%24device_id%22%3A%22bee93711-55ef-40fe-a004-b125d5dc7303%22%2C%22%24initial_referrer%22%3A%22%24direct%22%2C%22%24initial_referring_domain%22%3A%22%24direct%22%2C%22__mps%22%3A%7B%7D%2C%22__mpso%22%3A%7B%7D%2C%22__mpus%22%3A%7B%7D%2C%22__mpa%22%3A%7B%7D%2C%22__mpu%22%3A%7B%7D%2C%22__mpr%22%3A%5B%5D%2C%22__mpap%22%3A%5B%5D%2C%22%24user_id%22%3A%22e23c1529-6f7b-4d4e-8dc7-e0838cf877cc%22%7D; _ga_8FEWB057YH=GS2.1.s1766676713$o1$g1$t1766678241$j60$l0$h0; cf_clearance=gwRhTPCxW2BeczVJR0oC7adStElkw1B8NugmXmQJIyM-1766678241-1.2.1.1-RwX.RI0rOl5C_vGD6A4AeQDHt7DNqxjxsClMf8mdauPihb1L_tIOLWMhJip.fSYkDUBh7yB3XzHWg6p2Qs1yJjoA5o.iSfDyl4jj2abkL5BrKAC3U.bttVjBQuSlsgQR3iTzAoWRR3ezR_NsPtEkzuAMTS4mOerqlKg_ueWC2gReTzG1giyt4wAcTZbWTqb8VyOdekRKaPt3GmF_LpWVNiORiNXCdb_DOUNfDVvU674
origin
https://grok.com
priority
u=1, i
referer
https://grok.com/
sec-ch-ua
"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"
sec-ch-ua-mobile
?0
sec-ch-ua-platform
"macOS"
sec-fetch-dest
empty
sec-fetch-mode
cors
sec-fetch-site
same-origin
sentry-trace
8b95cf520bbb239b16d3072dffa691c5-88464d5719f3f180-0
traceparent
00-aca457bd0ef37303bcda8f7977bc7d45-db3eef553ac3100f-00
user-agent
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36
x-statsig-id
g4xW+pntTRVPLJBCLw51uJhp2/fhCjdE4ddE8PzTBdemzVAfPXdvPd4HzVcBxICExQh4fodTdQyJfZQwRazY5n8dh1jLgA
x-xai-request-id
d51ba032-bd84-4007-97f2-a892e280d09a