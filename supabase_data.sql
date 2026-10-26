--
-- PostgreSQL database dump
--

\restrict mCG53z86NpVMwxytnOMJX2AyP6IngqSNHbSO0fFwu4UJbblkjyYcEkUhMvjlBGc

-- Dumped from database version 17.11
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE auth.audit_log_entries DISABLE TRIGGER ALL;

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
\.


ALTER TABLE auth.audit_log_entries ENABLE TRIGGER ALL;

--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.custom_oauth_providers DISABLE TRIGGER ALL;

COPY auth.custom_oauth_providers (id, provider_type, identifier, name, client_id, client_secret, acceptable_client_ids, scopes, pkce_enabled, attribute_mapping, authorization_params, enabled, email_optional, issuer, discovery_url, skip_nonce_check, cached_discovery, discovery_cached_at, authorization_url, token_url, userinfo_url, jwks_uri, created_at, updated_at, custom_claims_allowlist) FROM stdin;
\.


ALTER TABLE auth.custom_oauth_providers ENABLE TRIGGER ALL;

--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state DISABLE TRIGGER ALL;

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at, invite_token, referrer, oauth_client_state_id, linking_target_id, email_optional) FROM stdin;
\.


ALTER TABLE auth.flow_state ENABLE TRIGGER ALL;

--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users DISABLE TRIGGER ALL;

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
\.


ALTER TABLE auth.users ENABLE TRIGGER ALL;

--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities DISABLE TRIGGER ALL;

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
\.


ALTER TABLE auth.identities ENABLE TRIGGER ALL;

--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances DISABLE TRIGGER ALL;

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


ALTER TABLE auth.instances ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.oauth_clients DISABLE TRIGGER ALL;

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type, token_endpoint_auth_method) FROM stdin;
\.


ALTER TABLE auth.oauth_clients ENABLE TRIGGER ALL;

--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions DISABLE TRIGGER ALL;

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
\.


ALTER TABLE auth.sessions ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims DISABLE TRIGGER ALL;

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
\.


ALTER TABLE auth.mfa_amr_claims ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors DISABLE TRIGGER ALL;

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


ALTER TABLE auth.mfa_factors ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges DISABLE TRIGGER ALL;

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


ALTER TABLE auth.mfa_challenges ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_recovery_code_sets; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_recovery_code_sets DISABLE TRIGGER ALL;

COPY auth.mfa_recovery_code_sets (id, user_id, mfa_factor_id, failed_verification_count, verification_locked_until, created_at, updated_at) FROM stdin;
\.


ALTER TABLE auth.mfa_recovery_code_sets ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_recovery_codes; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_recovery_codes DISABLE TRIGGER ALL;

COPY auth.mfa_recovery_codes (id, mfa_recovery_code_set_id, code_hash, consumed_at, created_at) FROM stdin;
\.


ALTER TABLE auth.mfa_recovery_codes ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.oauth_authorizations DISABLE TRIGGER ALL;

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


ALTER TABLE auth.oauth_authorizations ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.oauth_client_states DISABLE TRIGGER ALL;

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


ALTER TABLE auth.oauth_client_states ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.oauth_consents DISABLE TRIGGER ALL;

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


ALTER TABLE auth.oauth_consents ENABLE TRIGGER ALL;

--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens DISABLE TRIGGER ALL;

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at, expires_at) FROM stdin;
\.


ALTER TABLE auth.one_time_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens DISABLE TRIGGER ALL;

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
\.


ALTER TABLE auth.refresh_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers DISABLE TRIGGER ALL;

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


ALTER TABLE auth.sso_providers ENABLE TRIGGER ALL;

--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers DISABLE TRIGGER ALL;

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


ALTER TABLE auth.saml_providers ENABLE TRIGGER ALL;

--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states DISABLE TRIGGER ALL;

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


ALTER TABLE auth.saml_relay_states ENABLE TRIGGER ALL;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations DISABLE TRIGGER ALL;

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
20260115000000
20260121000000
20260219120000
20260302000000
20260625000000
20260821000000
20260821010000
20260824000000
20260824000001
20260831180000
\.


ALTER TABLE auth.schema_migrations ENABLE TRIGGER ALL;

--
-- Data for Name: scim_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.scim_tokens DISABLE TRIGGER ALL;

COPY auth.scim_tokens (id, sso_provider_id, token_hash, prefix, created_at, expires_at, revoked_at, last_used_at) FROM stdin;
\.


ALTER TABLE auth.scim_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: scim_users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.scim_users DISABLE TRIGGER ALL;

COPY auth.scim_users (id, sso_provider_id, user_id, resource, created_at, updated_at, deleted_at) FROM stdin;
\.


ALTER TABLE auth.scim_users ENABLE TRIGGER ALL;

--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains DISABLE TRIGGER ALL;

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


ALTER TABLE auth.sso_domains ENABLE TRIGGER ALL;

--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.webauthn_challenges DISABLE TRIGGER ALL;

COPY auth.webauthn_challenges (id, user_id, challenge_type, session_data, created_at, expires_at) FROM stdin;
\.


ALTER TABLE auth.webauthn_challenges ENABLE TRIGGER ALL;

--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.webauthn_credentials DISABLE TRIGGER ALL;

COPY auth.webauthn_credentials (id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, transports, backup_eligible, backed_up, friendly_name, created_at, updated_at, last_used_at) FROM stdin;
\.


ALTER TABLE auth.webauthn_credentials ENABLE TRIGGER ALL;

--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_users DISABLE TRIGGER ALL;

COPY public.admin_users (id, username, email, password_hash, role, is_first_login, otp_code_hash, otp_expires_at, otp_attempts, status, created_by, last_login_at, created_at, updated_at) FROM stdin;
11	rabbi	fozle5207@gmail.com	$2a$12$bkeQK4IPPMZ0ccnHkGH5g.gXFll84sDXw1u5fFbSbir4TpSdqsCM6	super_admin	f	\N	\N	0	active	admin	2026-10-24 20:48:10.886228+00	2026-10-24 20:48:07.954704+00	2026-10-24 20:48:10.886228+00
12	motinmirsagor	motinmir.vision@gmail.com	$2a$12$mfBvpC5Yk7ImvmtA78z4O.YhKB6/.GKkmqJWLGPlE9ky.qaulNmia	super_admin	f	\N	\N	0	active	admin	2026-10-25 03:15:13.567772+00	2026-10-25 03:15:10.59286+00	2026-10-25 03:15:13.567772+00
\.


ALTER TABLE public.admin_users ENABLE TRIGGER ALL;

--
-- Data for Name: admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_audit_logs DISABLE TRIGGER ALL;

COPY public.admin_audit_logs (id, actor_user_id, actor_username, actor_role, action, target_user_id, details, ip_address, created_at) FROM stdin;
1	\N	admin	super_admin	admin_user_created	\N	{"role": "super_admin", "email": "ohidhasan25805@gmail.com", "username": "ohid"}	10.197.204.133	2026-10-10 08:04:03.634243+00
2	\N	admin	super_admin	admin_user_created	\N	{"role": "super_admin", "email": "fozle5207@gmail.com", "username": "rabbi"}	10.196.42.28	2026-10-10 08:11:53.095959+00
3	\N	admin	super_admin	admin_user_status_changed	\N	{"status": "disabled"}	10.197.204.133	2026-10-10 10:11:44.759532+00
4	\N	admin	super_admin	admin_user_status_changed	\N	{"status": "active"}	10.196.42.28	2026-10-10 10:12:13.310968+00
5	\N	admin	super_admin	admin_user_created	\N	{"role": "super_admin", "email": "fozlerabbi.fb@gmail.com", "username": "rabbi2"}	10.196.42.28	2026-10-10 10:39:20.914457+00
9	\N	admin	super_admin	admin_user_created	\N	{"role": "super_admin", "email": "fozle5207@gmail.com", "username": "rabbi"}	10.197.206.233	2026-10-10 12:03:15.398041+00
11	\N	admin	super_admin	admin_invitation_created	\N	{"role": "admin", "email": "fozle5207@gmail.com", "username": "rabbi", "invitationId": "2"}	10.197.206.233	2026-10-10 12:30:46.605703+00
12	\N	admin	super_admin	admin_invitation_created	\N	{"role": "admin", "email": "ohidhasan25805@gmail.com", "username": "ohid", "invitationId": "3"}	10.197.206.233	2026-10-10 12:31:50.524237+00
14	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "ohidhasan25805@gmail.com", "username": "ohid", "invitationId": 3}	10.196.42.28	2026-10-10 12:37:07.844379+00
15	\N	admin	super_admin	admin_invitation_created	\N	{"role": "admin", "email": "ohidhasan25805@gmail.com", "username": "ohid", "invitationId": "4"}	10.197.204.133	2026-10-10 12:39:00.405292+00
16	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "ohidhasan25805@gmail.com", "username": "ohid", "invitationId": 4}	10.196.42.28	2026-10-10 12:43:08.232099+00
17	\N	admin	super_admin	admin_invitation_created	\N	{"role": "admin", "email": "ohidhasan25805@gmail.com", "username": "ohid", "invitationId": "5"}	10.197.206.233	2026-10-10 12:49:25.620552+00
18	\N	admin	super_admin	admin_invitation_accepted	\N	{"role": "admin", "username": "ohid", "invitationId": "5"}	10.197.206.233	2026-10-10 12:53:44.366854+00
19	\N	admin	super_admin	admin_invitation_created	\N	{"role": "admin", "email": "gmcproject.usa@gmail.com", "username": "gmcproject", "invitationId": "6"}	10.197.206.233	2026-10-10 15:45:49.204536+00
20	\N	admin	super_admin	admin_invitation_accepted	\N	{"role": "admin", "username": "gmcproject", "invitationId": "6"}	10.196.42.28	2026-10-10 15:46:48.477217+00
21	\N	gmcproject	admin	support_ticket_created	\N	{"title": "fdzbgf", "ticket_id": "1"}	10.197.204.133	2026-10-10 15:48:20.356412+00
24	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "motinmir.vision@gmail.com", "username": "motin", "invitationId": "7"}	10.197.206.233	2026-10-12 10:39:57.390898+00
25	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "motinmir.vision@gmail.com", "username": "motin", "invitationId": 7}	10.197.206.233	2026-10-12 18:30:44.172064+00
27	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "fozle5207@gmail.com", "username": "rabbi", "invitationId": "10", "selfServiceSignup": false}	10.193.217.5	2026-10-14 16:47:30.489492+00
28	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "fozle5207@gmail.com", "username": "rabbi", "invitationId": 10}	10.192.183.14	2026-10-14 16:47:36.98822+00
29	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "fozle5207@gmail.com", "username": "rabbi", "invitationId": "11"}	10.192.183.14	2026-10-14 16:59:13.562013+00
30	\N	admin	super_admin	admin_invitation_accepted	\N	{"role": "super_admin", "username": "rabbi", "invitationId": "11"}	10.193.217.5	2026-10-14 17:00:57.646035+00
33	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "fozle5207@gmail.com", "invitationId": "9"}	10.29.58.213	2026-10-24 20:19:07.843544+00
34	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "fozle5207@gmail.com", "username": "rabbi", "invitationId": 9}	10.27.188.5	2026-10-24 20:24:42.965249+00
35	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "fozle5207@gmail.com", "invitationId": "8"}	10.27.188.5	2026-10-24 20:24:58.77935+00
36	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "fozle5207@gmail.com", "username": "rabbi", "invitationId": 8}	10.27.188.5	2026-10-24 20:29:30.935777+00
37	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "fozle5207@gmail.com", "invitationId": "1"}	10.29.58.213	2026-10-24 20:29:37.374518+00
38	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "fozle5207@gmail.com", "username": "rabbi", "invitationId": 1}	10.29.58.213	2026-10-24 20:47:29.411863+00
39	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "fozle5207@gmail.com", "invitationId": "18"}	10.29.58.213	2026-10-24 20:47:34.345608+00
40	\N	admin	super_admin	admin_invitation_accepted	11	{"role": "super_admin", "username": "rabbi", "invitationId": "18"}	10.27.188.5	2026-10-24 20:48:10.656384+00
41	11	rabbi	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "motinmir.vision@gmail.com", "invitationId": "19"}	10.29.58.213	2026-10-24 20:50:11.653607+00
42	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "motinmir.vision@gmail.com", "username": null, "invitationId": 19}	10.27.188.5	2026-10-25 03:08:16.645133+00
43	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "motinmir.vision@gmail.com", "invitationId": "20"}	10.29.58.213	2026-10-25 03:08:29.72388+00
44	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "fozlerabbi.official.gmcservice@gmail.com", "invitationId": "21"}	10.27.188.5	2026-10-25 03:09:56.826079+00
45	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "motinmirsagor@gmail.com", "invitationId": "22"}	10.29.58.213	2026-10-25 03:11:56.316002+00
46	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "motinmirsagor@gmail.com", "username": null, "invitationId": 22}	10.29.8.12	2026-10-25 03:13:25.583079+00
47	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "fozlerabbi.official.gmcservice@gmail.com", "username": null, "invitationId": 21}	10.29.8.12	2026-10-25 03:13:29.690463+00
48	\N	admin	super_admin	admin_invitation_cancelled	\N	{"email": "motinmir.vision@gmail.com", "username": null, "invitationId": 20}	10.27.188.5	2026-10-25 03:13:34.177871+00
49	\N	admin	super_admin	admin_invitation_created	\N	{"role": "super_admin", "email": "motinmir.vision@gmail.com", "invitationId": "23"}	10.27.188.5	2026-10-25 03:14:33.185805+00
50	\N	admin	super_admin	admin_invitation_accepted	12	{"role": "super_admin", "username": "motinmirsagor", "invitationId": "23"}	10.27.188.5	2026-10-25 03:15:13.314958+00
\.


ALTER TABLE public.admin_audit_logs ENABLE TRIGGER ALL;

--
-- Data for Name: admin_invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_invitations DISABLE TRIGGER ALL;

COPY public.admin_invitations (id, username, email, role, target_user_id, token_hash, otp_code_hash, otp_expires_at, otp_attempts, status, created_by, expires_at, created_at, updated_at, self_service_signup) FROM stdin;
2	rabbi	fozle5207@gmail.com	admin	\N	\N	\N	\N	0	accepted	admin	2026-10-11 12:30:44.432+00	2026-10-10 12:30:44.432988+00	2026-10-10 12:33:22.680967+00	f
3	ohid	ohidhasan25805@gmail.com	admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-11 12:31:48.794+00	2026-10-10 12:31:48.794056+00	2026-10-10 12:37:07.841603+00	f
4	ohid	ohidhasan25805@gmail.com	admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-11 12:38:58.329+00	2026-10-10 12:38:58.329385+00	2026-10-10 12:43:08.229568+00	f
5	ohid	ohidhasan25805@gmail.com	admin	\N	\N	\N	\N	0	accepted	admin	2026-10-11 12:49:23.885+00	2026-10-10 12:49:23.88547+00	2026-10-10 12:53:44.265482+00	f
6	gmcproject	gmcproject.usa@gmail.com	admin	\N	\N	\N	\N	0	accepted	admin	2026-10-11 15:45:46.905+00	2026-10-10 15:45:46.905412+00	2026-10-10 15:46:48.47519+00	f
7	motin	motinmir.vision@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-13 10:39:55.584+00	2026-10-12 10:39:55.584506+00	2026-10-12 18:30:44.169695+00	f
10	rabbi	fozle5207@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-15 16:47:27.936+00	2026-10-14 16:47:27.936446+00	2026-10-14 16:47:36.984758+00	f
11	rabbi	fozle5207@gmail.com	super_admin	\N	\N	\N	\N	0	accepted	admin	2026-10-15 16:59:11.129+00	2026-10-14 16:59:11.133348+00	2026-10-14 17:00:57.644219+00	f
9	rabbi	fozle5207@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-25 20:19:07.121+00	2026-10-24 20:19:07.158899+00	2026-10-24 20:24:42.890209+00	f
8	rabbi	fozle5207@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-25 20:24:58.167+00	2026-10-24 20:24:58.203501+00	2026-10-24 20:29:30.861813+00	f
1	rabbi	fozle5207@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-25 20:29:36.757+00	2026-10-24 20:29:36.793739+00	2026-10-24 20:47:29.331277+00	f
18	\N	fozle5207@gmail.com	super_admin	\N	\N	\N	\N	0	accepted	admin	2026-10-25 20:47:33.71+00	2026-10-24 20:47:33.747795+00	2026-10-24 20:48:07.954704+00	f
19	\N	motinmir.vision@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	rabbi	2026-10-25 20:50:11.028+00	2026-10-24 20:50:11.065755+00	2026-10-25 03:08:16.567312+00	f
22	\N	motinmirsagor@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-26 03:11:55.701+00	2026-10-25 03:11:55.738218+00	2026-10-25 03:13:25.509014+00	f
21	\N	fozlerabbi.official.gmcservice@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-26 03:09:56.214+00	2026-10-25 03:09:56.250478+00	2026-10-25 03:13:29.616697+00	f
20	\N	motinmir.vision@gmail.com	super_admin	\N	\N	\N	\N	0	cancelled	admin	2026-10-26 03:08:29.093+00	2026-10-25 03:08:29.129965+00	2026-10-25 03:13:34.103157+00	f
23	\N	motinmir.vision@gmail.com	super_admin	\N	\N	\N	\N	0	accepted	admin	2026-10-26 03:14:32.556+00	2026-10-25 03:14:32.593267+00	2026-10-25 03:15:10.59286+00	f
\.


ALTER TABLE public.admin_invitations ENABLE TRIGGER ALL;

--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.app_settings DISABLE TRIGGER ALL;

COPY public.app_settings (key, value, updated_at) FROM stdin;
notification_rule_pppoe_expired_whatsapp_enabled	true	2026-10-25 11:57:45.930762+00
messenger_page_access_token	EAAs3BYndookBSuIh50q4hRuPrG50XATdjbLlEKMa7KJZAfahFkrvkMszsN5FFMF7wtLQxlvHB6H3IZAwZCyfhWKY43ZB0WCQTuEiIiaT4GYG3Q34LWn424bz44RZCMrmjC6xRWeOJYOXDvnHu8pZBZCXZA9kzyneB7rpuTZA9R7hSZCOsah0Hns7qXyPQIlMT3kZAUQhfV68FGYbwZDZD	2026-10-16 03:53:51.93277+00
messenger_page_id	1121492477722655	2026-10-16 04:59:23.002913+00
messenger_verify_token	Fozlerabi123@@	2026-10-16 03:53:51.935598+00
network_discovery_interval_minutes	5	2026-10-12 12:52:54.091092+00
notification_channel_messenger_enabled	true	2026-10-16 04:59:22.998976+00
notification_channel_telegram_enabled	true	2026-10-16 04:59:22.997669+00
notification_rule_hotspot_expired_messenger_enabled	true	2026-10-16 04:59:23.054187+00
notification_rule_hotspot_expired_telegram_enabled	true	2026-10-16 04:59:23.05282+00
notification_rule_hotspot_expiry_warning_messenger_enabled	true	2026-10-16 04:59:23.047255+00
notification_rule_hotspot_expiry_warning_telegram_enabled	true	2026-10-16 04:59:23.045911+00
notification_rule_hotspot_payment_messenger_enabled	true	2026-10-16 04:59:23.019063+00
notification_rule_hotspot_payment_telegram_enabled	true	2026-10-16 04:59:23.017753+00
notification_rule_hotspot_recharge_messenger_enabled	true	2026-10-16 04:59:23.025709+00
notification_rule_hotspot_recharge_telegram_enabled	true	2026-10-16 04:59:23.024314+00
notification_rule_hotspot_renewal_messenger_enabled	true	2026-10-16 04:59:23.032576+00
notification_rule_hotspot_renewal_telegram_enabled	true	2026-10-16 04:59:23.031048+00
notification_rule_hotspot_welcome_messenger_enabled	true	2026-10-16 04:59:23.040522+00
notification_rule_hotspot_welcome_telegram_enabled	true	2026-10-16 04:59:23.039298+00
notification_rule_pppoe_expired_messenger_enabled	true	2026-10-16 04:59:23.096106+00
notification_rule_pppoe_expired_telegram_enabled	true	2026-10-16 04:59:23.094731+00
notification_rule_pppoe_expiry_warning_messenger_enabled	true	2026-10-16 04:59:23.089158+00
notification_rule_pppoe_expiry_warning_telegram_enabled	true	2026-10-16 04:59:23.087686+00
notification_rule_pppoe_payment_messenger_enabled	true	2026-10-16 04:59:23.06091+00
notification_rule_pppoe_payment_telegram_enabled	true	2026-10-16 04:59:23.059556+00
notification_rule_pppoe_recharge_messenger_enabled	true	2026-10-16 04:59:23.06822+00
notification_rule_hotspot_renewal_sms_enabled	true	2026-10-25 11:57:43.811058+00
notification_rule_pppoe_recharge_telegram_enabled	true	2026-10-16 04:59:23.066802+00
notification_rule_hotspot_renewal_whatsapp_enabled	true	2026-10-25 11:57:43.886901+00
notification_rule_hotspot_welcome_sms_enabled	true	2026-10-25 11:57:44.038447+00
notification_rule_hotspot_welcome_whatsapp_enabled	true	2026-10-25 11:57:44.114149+00
notification_rule_hotspot_expiry_warning_sms_enabled	true	2026-10-25 11:57:44.265941+00
notification_rule_hotspot_expiry_warning_whatsapp_enabled	true	2026-10-25 11:57:44.341586+00
notification_rule_hotspot_expiry_warning_email_enabled	true	2026-10-25 11:57:44.417738+00
email_apps_script_url	https://script.google.com/macros/s/AKfycbzlAPt9IDxuVy9JywgWOQlVuQX-Y12qEbEqdhe2dv02Z4hLdelOW2Uz3Pq3KX0kCjex/exec	2026-10-24 12:20:50.148454+00
notification_channel_whatsapp_enabled	true	2026-10-25 11:57:42.677247+00
notification_channel_email_enabled	true	2026-10-25 11:57:42.752673+00
email_provider_mode	smtp	2026-10-25 11:57:42.828131+00
email_from_name	FAZ NETWORK Billing	2026-10-25 11:57:43.206447+00
mfs_bkash_number	01339932887	2026-10-22 20:53:01.804119+00
mfs_nagad_number	01339932887	2026-10-22 20:53:01.804119+00
mfs_rocket_number		2026-10-22 20:53:01.804119+00
mfs_upay_number		2026-10-22 20:53:01.804119+00
email_apps_script_token	faz-ZsM%dchPeeTX+$abdXo)GtzqIq9&	2026-10-23 13:37:34.524575+00
email_from_address	billing@faznetwork.com	2026-10-25 11:57:43.282154+00
notification_rule_hotspot_payment_whatsapp_enabled	true	2026-10-25 11:57:43.433102+00
notification_rule_hotspot_expired_sms_enabled	true	2026-10-25 11:57:44.493308+00
notification_rule_hotspot_payment_email_enabled	true	2026-10-25 11:57:43.508687+00
notification_rule_hotspot_expired_whatsapp_enabled	true	2026-10-25 11:57:44.569065+00
notification_rule_pppoe_payment_sms_enabled	true	2026-10-25 11:57:44.720402+00
notification_rule_pppoe_payment_whatsapp_enabled	true	2026-10-25 11:57:44.796457+00
notification_rule_pppoe_recharge_whatsapp_enabled	true	2026-10-25 11:57:45.023456+00
notification_rule_pppoe_renewal_email_enabled	true	2026-10-25 11:57:45.326207+00
notification_rule_hotspot_recharge_sms_enabled	true	2026-10-25 11:57:43.584283+00
notification_rule_pppoe_expiry_warning_sms_enabled	true	2026-10-25 11:57:45.628239+00
notification_rule_hotspot_recharge_whatsapp_enabled	true	2026-10-25 11:57:43.660285+00
notification_rule_pppoe_expiry_warning_whatsapp_enabled	true	2026-10-25 11:57:45.703889+00
notification_rule_pppoe_expiry_warning_email_enabled	true	2026-10-25 11:57:45.779593+00
notification_rule_pppoe_expired_sms_enabled	true	2026-10-25 11:57:45.85515+00
notification_rule_pppoe_renewal_messenger_enabled	true	2026-10-16 04:59:23.075328+00
notification_rule_pppoe_renewal_telegram_enabled	true	2026-10-16 04:59:23.073809+00
notification_rule_pppoe_welcome_messenger_enabled	true	2026-10-16 04:59:23.082126+00
notification_rule_pppoe_welcome_telegram_enabled	true	2026-10-16 04:59:23.080822+00
sms_event_expiry_warning	true	2026-10-09 22:25:15.102053+00
sms_event_line_expiry	true	2026-10-09 22:25:15.105535+00
sms_event_payment_receipt	true	2026-10-09 22:25:15.104217+00
sms_event_welcome	true	2026-10-15 22:31:20.025874+00
sms_template_expiry_warning	Dear {name}, your FAZ NETWORK bill of Tk {amount} is expiring on {expiry_date}. Please pay to avoid line cut. Helpline: {support_phone}	2026-10-09 22:25:15.106851+00
sms_template_line_block	Dear {name}, your internet connection has expired. Please recharge via bKash/Nagad to reactivate your internet immediately. Helpline: {support_phone}	2026-10-09 22:25:15.109636+00
sms_template_payment_receipt	Dear {name}, payment of Tk {amount} received successfully via {gateway}. TrxID: {trx_id}. Your line is active till {new_expiry_date}. Thank you, FAZ NETWORK.	2026-10-09 22:25:15.108258+00
sms_template_welcome	Welcome to FAZ NETWORK, {name}. Your internet account {username} is ready. Helpline: {support_phone}	2026-10-15 22:31:20.025874+00
telegram_bot_token	8806599583:AAGqbjfGQL-jjvAQs173q7KXTNxx0eRXnBc	2026-10-16 04:44:25.774753+00
telegram_default_chat_id	@8673926064	2026-10-16 04:59:23.001616+00
whatsapp_enabled	false	2026-10-15 22:31:20.025874+00
sms_api_url		2026-10-25 11:57:41.99269+00
smtp_password	csqy cprk vzcf bkqn	2026-10-24 18:56:14.61631+00
sms_sender_id		2026-10-25 11:57:42.068235+00
sms_api_method	POST_JSON	2026-10-25 11:57:42.143791+00
personal_payment_webhook_url	/api/webhooks/forward	2026-10-23 00:56:47.971982+00
personal_payment_webhook_enabled	true	2026-10-23 00:56:47.971982+00
personal_payment_webhook_secret	f23378d42852e3a1eaa6e52e2bba432dbf9f4765edb6b699e2664a0bd008849c	2026-10-23 00:56:47.971982+00
sms_http_param_mapping	{"to":"{to}","message":"{message}","token":"{token}","sender_id":"{sender_id}"}	2026-10-25 11:57:42.219581+00
sms_device_url		2026-10-25 11:57:42.295067+00
sms_device_webhook_url		2026-10-25 11:57:42.370688+00
sms_device_http_method	POST_JSON	2026-10-25 11:57:42.446369+00
sms_device_param_mapping	{"to":"{to}","message":"{message}","token":"{token}"}	2026-10-25 11:57:42.522119+00
notification_channel_sms_enabled	true	2026-10-25 11:57:42.600444+00
smtp_host	smtp.gmail.com	2026-10-25 11:57:42.903961+00
smtp_port	587	2026-10-25 11:57:42.980009+00
smtp_secure	true	2026-10-25 11:57:43.055541+00
smtp_username	billing@faznetwork.com	2026-10-25 11:57:43.130853+00
notification_rule_hotspot_payment_sms_enabled	true	2026-10-25 11:57:43.35765+00
notification_rule_hotspot_recharge_email_enabled	true	2026-10-25 11:57:43.73569+00
notification_rule_hotspot_renewal_email_enabled	true	2026-10-25 11:57:43.962677+00
notification_rule_hotspot_welcome_email_enabled	true	2026-10-25 11:57:44.189829+00
notification_rule_hotspot_expired_email_enabled	true	2026-10-25 11:57:44.644705+00
notification_rule_pppoe_payment_email_enabled	true	2026-10-25 11:57:44.872091+00
notification_rule_pppoe_recharge_sms_enabled	true	2026-10-25 11:57:44.947996+00
notification_rule_pppoe_recharge_email_enabled	true	2026-10-25 11:57:45.099132+00
notification_rule_pppoe_renewal_sms_enabled	true	2026-10-25 11:57:45.175281+00
notification_rule_pppoe_renewal_whatsapp_enabled	true	2026-10-25 11:57:45.250797+00
notification_rule_pppoe_welcome_sms_enabled	true	2026-10-25 11:57:45.401663+00
notification_rule_pppoe_welcome_whatsapp_enabled	true	2026-10-25 11:57:45.477118+00
notification_rule_pppoe_welcome_email_enabled	true	2026-10-25 11:57:45.552694+00
notification_rule_pppoe_expired_email_enabled	true	2026-10-25 11:57:46.00647+00
sms_gateway_mode	disabled	2026-10-25 11:57:41.765678+00
sms_provider_mode	disabled	2026-10-25 11:57:41.841351+00
sms_provider_preset	custom	2026-10-25 11:57:41.917164+00
hotspot_public_portal_config	{"portalTitle":"FAZ NETWORK","enabledProfiles":["30-Day","12-Hour","1-Day","3-Day","7-Day","15-Day","100GB (Unlimited)","300GB (Unlimited)"],"mfs":[{"name":"bKash (Send Money)","number":"01339932887","enabled":true},{"name":"Nagad (Send Money)","number":"01339932887","enabled":true},{"name":"Rocket (Send Money)","number":"","enabled":false}]}	2026-10-23 13:00:54.208889+00
hotspot_profile_metadata	{"100GB (Unlimited)":{"price":200,"validityValue":100,"validityUnit":"gb","validityLabel":"100 GB","limitBytesTotal":107374182400,"updatedAt":"2026-10-08T23:06:16.913Z"},"300GB (Unlimited)":{"price":300,"validityValue":300,"validityUnit":"gb","validityLabel":"300 GB","limitBytesTotal":322122547200,"updatedAt":"2026-10-08T23:08:06.386Z"},"30-Day":{"price":150,"validityValue":30,"validityUnit":"days","validityLabel":"30 Days","limitBytesTotal":0,"updatedAt":"2026-10-08T23:09:12.240Z"},"12-Hour":{"price":15,"validityValue":12,"validityUnit":"hours","validityLabel":"12 Hours","limitBytesTotal":0,"updatedAt":"2026-10-08T23:10:07.199Z"},"1-Day":{"price":20,"validityValue":1,"validityUnit":"days","validityLabel":"1 Day","limitBytesTotal":0,"updatedAt":"2026-10-08T23:10:25.214Z"},"3-Day":{"price":40,"validityValue":3,"validityUnit":"days","validityLabel":"3 Days","limitBytesTotal":0,"updatedAt":"2026-10-08T23:10:50.505Z"},"7-Day":{"price":60,"validityValue":7,"validityUnit":"days","validityLabel":"7 Days","limitBytesTotal":0,"updatedAt":"2026-10-08T23:11:12.777Z"},"15-Day":{"price":90,"validityValue":15,"validityUnit":"days","validityLabel":"15 Days","limitBytesTotal":0,"updatedAt":"2026-10-08T23:11:33.260Z"}}	2026-10-25 23:29:13.475422+00
mfs_bkash_sender_ids	["bkash","16247"]	2026-10-22 20:53:01.804119+00
mfs_nagad_sender_ids	["nagad","16167"]	2026-10-22 20:53:01.804119+00
mfs_rocket_sender_ids	["rocket","16216","dbbl"]	2026-10-22 20:53:01.804119+00
mfs_upay_sender_ids	["upay","16268"]	2026-10-22 20:53:01.804119+00
\.


ALTER TABLE public.app_settings ENABLE TRIGGER ALL;

--
-- Data for Name: network_devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.network_devices DISABLE TRIGGER ALL;

COPY public.network_devices (id, device_type, name, vendor, model, management_ip, mac_address, serial_number, location, parent_device_id, notes, last_seen_at, created_at, updated_at, management_port, management_username, encrypted_management_password) FROM stdin;
3	olt	VSOL	V-SOL	V-SOL V1601E04-DP	172.21.21.2	\N	V2510310625	Dinmara Bazar, Atwari, Panchagarh	\N	\N	\N	2026-10-12 12:27:25.522674+00	2026-10-12 12:27:25.522674+00	\N	rabbi	bNxsAmEH/htgWzUg.fYA5jkH5dU+r70MHHEfjBg==.AnZXMCU=
7	mikrotik	RB 4011	MikroTik	RB4011iGS+	103.54.37.182	\N	\N	\N	\N	RouterOS identity: Tp-link	2026-10-18 17:56:36.390123+00	2026-10-18 17:56:36.390123+00	2026-10-18 17:56:36.390123+00	\N	\N	\N
\.


ALTER TABLE public.network_devices ENABLE TRIGGER ALL;

--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.customers DISABLE TRIGGER ALL;

COPY public.customers (id, full_name, phone, connection_date, username, password, package_name, profile, monthly_bill, nid, installation_address, fiber_box, onu_mac, remarks, provisioning_status, status, router_id, created_at, updated_at, email, whatsapp_phone, telegram_link, facebook_link, remote_address, ip_pool, expiration_date, billing_status, last_paid_at, paid_until, alternative_phone, olt_pon_port, distribution_box, onu_serial, fiber_drop_core, area_zone, last_disconnect_reason, billing_cycle, billing_duration_days, billing_expiry_override, onu_rx_power_dbm, onu_rx_power_observed_at, onu_rx_power_source_device_id, messenger_psid, telegram_chat_id, expiry_date, router_mac) FROM stdin;
32	Tonmoy Debnath	01770708734	2026-10-09	1011	1011	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-10 13:55:10.8566+00	2026-10-25 13:57:25.55899+00	\N	\N	\N	\N	\N	\N	2026-11-25	paid	2026-10-25 13:57:25.55899+00	2026-11-25		\N					Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	BC:62:CE:0A:54:3C
31	Noyon	01332081110	2026-10-09	1010	1010	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-10 13:33:49.333754+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-22	paid	2026-10-21 14:45:10.386598+00	2026-11-22	—	\N					Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	40:ED:00:32:62:81
33	Arif Islam	01773893420	2026-10-05	10012	10012	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-10 14:07:44.224589+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-05	paid	\N	2026-11-05		\N					\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	30:68:93:10:4F:7A
17	Muslim Uddin	01723250330	2026-10-09	muslim1234	1234	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	\N	2026-10-09 19:19:45.073227+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-22	paid	2026-10-22 07:53:48.506937+00	2026-11-22		\N					\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	B0:19:21:03:5A:38
9	Abdur Rajjak	01611939732	2026-10-09	10004	10004	45 Mbps	45 Mbps	500.00	\N	\N	\N	\N	\N	provisioned	active	103.54.37.182	2026-10-09 05:32:28.322641+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-09	paid	2026-10-09 15:02:37.026565+00	2026-11-09	\N	\N	\N	\N	\N	\N	Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	08:8A:F1:04:32:71
10	Shafikul Islam	01787805753	2026-10-09	shafikul404	1234	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	\N	2026-10-09 14:59:24.498751+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-13	paid	2026-10-12 15:36:38.722557+00	2026-11-13	—	\N					Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	30:07:5C:73:39:AB
26	Shuvo Islam	01764867748	2026-10-09	10001	10001	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-10 00:38:36.245715+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-10	paid	2026-10-10 18:01:57.283992+00	2026-11-10		\N					\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	08:8A:F1:8F:63:D6
39	Durjoy Debnath	01305155068	2026-10-22	10014	10014	45 Mbps	45 Mbps	500.00	\N	\N	\N	\N	\N	provisioned	expired	103.54.37.182	2026-10-23 05:14:49.120509+00	2026-10-23 05:25:30.190519+00	\N	\N	\N	\N	\N	\N	2026-10-22	unpaid	\N	\N	\N	\N	\N	\N	\N	\N	\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	\N
14	Tusher Debnath	01774036879	2026-10-09	10009	10009	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	\N	2026-10-09 18:18:21.756985+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-22	paid	2026-10-22 12:56:39.312572+00	2026-11-22		\N					\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	40:AE:30:F1:C4:B0
36	Pulok Debnath	01796730594	2026-10-14	10010	10010	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-15 19:33:18.859997+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-16	paid	2026-10-16 12:46:29.619851+00	2026-11-16		\N					\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	7C:F1:7E:88:7B:78
35	Md Fozle Rabbi	01710415717	2026-10-08	10006	10006	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-10 20:32:48.377874+00	2026-10-25 00:11:32.476253+00	fozle5207@gmail.com	01710415717	@rabbipro12	https://www.facebook.com/profile.php?id=61592126751483	\N	\N	2027-02-23	paid	2026-10-24 21:26:48.301862+00	2027-01-23		\N					Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	10:5A:95:70:2D:C9
38	Ratan Chandra	01767094042	2026-10-21	10013	10013	45 Mbps	45 Mbps	500.00	\N	\N	\N	\N	\N	provisioned	active	103.54.37.182	2026-10-21 13:07:38.364129+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-21	paid	\N	2026-11-21	\N	\N	\N	\N	\N	\N	\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	08:8A:F1:9D:1B:46
34	Mithun Debnath	01737576877	2026-10-10	mithun1234	1234	45 Mbps	45 Mbps	500.00	\N	\N	\N	\N	\N	provisioned	active	103.54.37.182	2026-10-10 17:33:50.708117+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-02	unpaid	\N	\N	\N	\N	\N	\N	\N	\N	\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	80:AF:CA:70:B3:59
37	Prithiraj Debnath	01763236150	2026-10-17	10011	10011	45 Mbps	45 Mbps	500.00	\N	\N	\N	\N	\N	provisioned	active	103.54.37.182	2026-10-18 04:04:03.090383+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-18	paid	2026-10-18 04:04:32.291266+00	2026-11-18	\N	\N	\N	\N	\N	\N	\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	BC:E0:01:7C:CC:0B
8	Dulal Uddin	01714594628	2026-10-09	10003	10003	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-09 05:29:15.338084+00	2026-10-24 00:36:40.503124+00	\N	01714594628	\N	\N	\N	\N	2026-11-09	paid	\N	2026-11-09		\N					Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	B0:19:21:13:E3:9B
30	Nayum Islam	01716832502	2026-10-09	10008	10008	45 Mbps	45 Mbps	500.00	\N	\N	\N	\N	\N	provisioned	active	103.54.37.182	2026-10-10 01:21:44.826646+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-11	paid	2026-10-11 03:02:45.5122+00	2026-11-11	\N	\N	\N	\N	\N	\N	Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	08:8A:F1:10:D8:CA
29	Ferdous Islam	01738204194	2026-10-09	10007	10007	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-10 00:52:01.831974+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-18	paid	2026-10-18 01:57:59.027731+00	2026-11-18		\N					Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	30:07:5C:D9:61:EB
16	Dr. Ratan Chandra	01728541854	2026-10-09	ratanchandra854	1234	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	\N	2026-10-09 19:16:02.507114+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-11	paid	2026-10-11 03:59:18.72852+00	2026-11-11		\N					Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	30:07:5C:D9:6B:5A
13	Prodip Debnath	01775521817	2026-10-10	prodip1234	1234	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	\N	2026-10-09 18:15:36.136022+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-03	unpaid	\N	\N		\N					\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	BC:E0:01:AF:F7:C7
25	Monzirul Islam	01611939762	2026-09-05	10005	10005	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	\N	2026-10-09 22:47:08.328253+00	2026-10-24 00:36:40.503124+00	\N	\N	\N	\N	\N	\N	2026-11-04	unpaid	\N	\N	—	\N					\N	monthly	\N	f	\N	\N	\N	\N	\N	\N	8C:90:2D:34:77:E1
27	Anu Debnath	01742671956	2026-10-05	10002	10002	45 Mbps	45 Mbps	500.00	\N			\N		provisioned	active	103.54.37.182	2026-10-10 00:42:04.989467+00	2026-10-24 20:59:41.615875+00	\N	\N	\N	\N	\N	\N	2026-11-11	paid	2026-10-11 13:44:41.882109+00	2026-11-11		\N					Manual kick by admin	monthly	\N	f	\N	\N	\N	\N	\N	\N	CC:2D:21:01:B5:67
\.


ALTER TABLE public.customers ENABLE TRIGGER ALL;

--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs DISABLE TRIGGER ALL;

COPY public.audit_logs (id, customer_id, admin_id, action, details, ip_address, created_at) FROM stdin;
6	9	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10004","expirationDate":"2026-10-07T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","sessionDisconnected":false}	\N	2026-10-09 14:54:34.595474+00
7	10	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Shafikul Islam","phone":"01787805753","username":"shafikul404","package":"FZN 30 Mbps","profile":"FZN 30 Mbps","area":null,"expirationDate":"2026-10-12T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Shafikul Islam","phone":"01787805753","username":"shafikul404","package":"FZN 30 Mbps","profile":"FZN 30 Mbps","area":"","expirationDate":"2026-10-13","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.46	2026-10-09 14:59:29.352032+00
8	10	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Shafikul Islam","phone":"01787805753","username":"shafikul404","package":"FZN 30 Mbps","profile":"FZN 30 Mbps","area":"","expirationDate":"2026-10-12T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Shafikul Islam","phone":"01787805753","username":"shafikul404","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-13","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.46	2026-10-09 15:00:11.706591+00
9	10	admin	CHANGE_PACKAGE	{"message":"Package changed from FZN 30 Mbps to 45 Mbps","previousPackage":"FZN 30 Mbps","previousProfile":"FZN 30 Mbps","newPackage":"45 Mbps","newProfile":"45 Mbps"}	103.23.204.46	2026-10-09 15:00:11.708459+00
10	9	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-1791558151981-9). Extended validity to 2026-11-09","amount":500,"method":"cash","trxId":"CASH-1791558151981-9","newExpiration":"2026-11-09"}	103.23.204.46	2026-10-09 15:02:37.031828+00
14	13	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Prodip Debnath","phone":"01775521817","username":"prodip1234","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-11-02T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Prodip Debnath","phone":"01775521817","username":"prodip1234","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-03","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.46	2026-10-09 18:15:40.18885+00
15	14	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Tusher Debnath","phone":"01774036879","username":"tusher1234","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-10-21T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Tusher Debnath","phone":"01774036879","username":"tusher1234","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-22","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.46	2026-10-09 18:18:25.746625+00
17	9	admin	CHANGE_PACKAGE	{"message":"Package changed to 45 Mbps","previousPackage":"45 Mbps","previousProfile":"45 Mbps","newPackage":"45 Mbps","newProfile":"45 Mbps","newPool":"PPPoE_Pool","newRateLimit":null,"sessionDisconnected":true}	103.23.204.46	2026-10-09 18:22:47.220365+00
18	16	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Dr. Ratan Chandra","phone":"01728541854","username":"ratanchandra854","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-10-10T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Dr. Ratan Chandra","phone":"01728541854","username":"ratanchandra854","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-11","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.46	2026-10-09 19:16:06.548251+00
19	10	admin	RENEW	{"message":"Bill marked as paid; restored package profile and reset active session","paidUntil":"2026-11-13","package":"45 Mbps","profile":"45 Mbps"}	103.23.204.46	2026-10-09 19:17:43.635289+00
20	17	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Muslim Uddin","phone":"01723250330","username":"muslim1234","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-10-21T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Muslim Uddin","phone":"01723250330","username":"muslim1234","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-22","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.46	2026-10-09 19:19:49.18575+00
78	9	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10004","callerId":null,"expiryDate":"2026-11-09","result":"updated"}	103.23.204.34	2026-10-12 15:46:53.604886+00
27	10	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Shafikul Islam","phone":"01787805753","username":"shafikul404","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-12T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Shafikul Islam","phone":"01787805753","username":"shafikul404","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-13","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	103.23.204.46	2026-10-09 19:41:46.90717+00
28	10	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"shafikul404","sessions":1}	103.23.204.46	2026-10-09 22:37:23.970743+00
30	8	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10003","sessions":1}	103.23.204.46	2026-10-09 22:50:34.471488+00
32	16	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"ratanchandra854","sessions":1}	103.23.204.46	2026-10-09 23:36:34.712448+00
33	9	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10004","sessions":1}	103.23.204.46	2026-10-09 23:53:33.631649+00
35	25	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Monzirul Islam","phone":"01611939762","username":"monzirul1234","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-10-17T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Monzirul Islam","phone":"01611939762","username":"monzirul1234","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-09","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.46	2026-10-10 00:40:00.11952+00
36	25	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Monzirul Islam","phone":"01611939762","username":"monzirul1234","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-08T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Monzirul Islam","phone":"01611939762","username":"10005","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-06","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.46	2026-10-10 00:45:48.557022+00
37	25	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10005","expirationDate":"2026-10-05T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":false}	\N	2026-10-10 01:21:04.82142+00
39	30	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10008","expirationDate":"2026-10-08T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":false}	\N	2026-10-10 02:21:04.669989+00
40	14	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Tusher Debnath","phone":"01774036879","username":"tusher1234","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-21T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Tusher Debnath","phone":"01774036879","username":"10009","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-22","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.38	2026-10-10 05:46:20.074551+00
41	25	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Monzirul Islam","phone":"01611939762","username":"10005","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-05T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Monzirul Islam","phone":"01611939762","username":"10005","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-04","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.38	2026-10-10 06:11:49.668547+00
43	16	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"ratanchandra854","sessions":1}	103.23.204.38	2026-10-10 06:49:57.8938+00
46	31	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Noyon","phone":"0133584522","username":"1010","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-10-21T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Noyon","phone":"01332081110","username":"1010","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-22","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.38	2026-10-10 13:35:51.592479+00
47	31	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"1010","sessions":1}	103.23.204.38	2026-10-10 13:40:46.458569+00
48	25	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10005","callerId":null,"expiryDate":"2026-11-04","result":"created"}	103.23.204.38	2026-10-10 15:18:54.526384+00
49	33	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Arif Islam","phone":"01773893420","username":"1012","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-11-04T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Arif Islam","phone":"01773893420","username":"10012","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-05","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	103.23.204.38	2026-10-10 15:38:58.818828+00
50	33	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10012","callerId":null,"expiryDate":"2026-11-05","result":"updated"}	103.23.204.38	2026-10-10 15:42:06.36433+00
51	26	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-1791655313704-26). Extended validity to 2026-12-10","amount":500,"method":"cash","trxId":"CASH-1791655313704-26","newExpiration":"2026-12-10"}	103.23.204.38	2026-10-10 18:01:57.291965+00
79	8	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10003","callerId":null,"expiryDate":"2026-11-09","result":"updated"}	103.23.204.36	2026-10-12 17:48:49.320014+00
52	26	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Shuvo Islam","phone":"01764867748","username":"10001","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-12-09T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Shuvo Islam","phone":"01764867748","username":"10001","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-10","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	103.23.204.38	2026-10-10 20:12:03.372337+00
53	27	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-11-09T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-08-30","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.38	2026-10-10 20:22:11.8477+00
54	16	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Dr. Ratan Chandra","phone":"01728541854","username":"ratanchandra854","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-10T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Dr. Ratan Chandra","phone":"01728541854","username":"ratanchandra854","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-10","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.38	2026-10-10 20:26:07.123687+00
55	27	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10002","expirationDate":"2026-08-29T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":false}	\N	2026-10-10 20:31:16.804793+00
56	16	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"ratanchandra854","expirationDate":"2026-10-09T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":true}	\N	2026-10-10 20:31:22.982022+00
57	35	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10006","expirationDate":"2026-10-09T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":false}	\N	2026-10-10 20:45:13.798681+00
58	30	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10008","callerId":null,"expiryDate":"2026-10-09","result":"created"}	103.23.204.38	2026-10-11 02:57:52.803721+00
59	30	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10008","callerId":null,"expiryDate":"2026-10-09","result":"updated"}	103.23.204.38	2026-10-11 02:58:27.559015+00
60	30	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10008","callerId":null,"expiryDate":"2026-10-09","result":"updated"}	103.23.204.38	2026-10-11 02:59:51.650461+00
61	30	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10008","callerId":null,"expiryDate":"2026-10-09","result":"updated"}	103.23.204.38	2026-10-11 03:01:03.634693+00
62	30	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10008","callerId":null,"expiryDate":"2026-10-09","result":"updated"}	103.23.204.38	2026-10-11 03:02:10.211563+00
63	30	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-1791687761973-30). Extended validity to 2026-11-11","amount":500,"method":"cash","trxId":"CASH-1791687761973-30","newExpiration":"2026-11-11"}	103.23.204.38	2026-10-11 03:02:45.518011+00
64	30	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10008","callerId":null,"expiryDate":"2026-11-11","result":"updated"}	103.23.204.38	2026-10-11 03:06:12.36842+00
65	30	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10008","callerId":null,"expiryDate":"2026-11-11","result":"updated"}	103.23.204.38	2026-10-11 03:08:03.327228+00
66	30	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10008","sessions":1}	103.23.204.38	2026-10-11 03:08:09.17108+00
67	16	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1791691153996). Extended validity to 2026-11-11","amount":500,"method":"cash","trxId":"CASH-RENEW-1791691153996","newExpiration":"2026-11-11"}	103.23.204.38	2026-10-11 03:59:18.741999+00
69	8	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10003","callerId":null,"expiryDate":"2026-11-09","result":"updated"}	103.23.204.38	2026-10-11 10:59:48.531309+00
70	9	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10004","sessions":1}	103.23.204.38	2026-10-11 11:18:12.11091+00
71	16	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"ratanchandra854","callerId":null,"expiryDate":"2026-11-11","result":"updated"}	103.23.204.34	2026-10-11 12:13:16.187841+00
72	27	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-1791726278337-27). Extended validity to 2026-11-11","amount":500,"method":"cash","trxId":"CASH-1791726278337-27","newExpiration":"2026-11-11"}	103.23.204.38	2026-10-11 13:44:41.888212+00
73	26	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10001","callerId":null,"expiryDate":"2026-11-10","result":"updated"}	103.23.204.34	2026-10-11 15:20:18.873143+00
75	8	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10003","callerId":null,"expiryDate":"2026-11-09","result":"updated"}	103.23.204.34	2026-10-12 10:39:00.647405+00
76	8	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10003","callerId":null,"expiryDate":"2026-11-09","result":"updated"}	103.23.204.34	2026-10-12 11:03:34.474419+00
77	10	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1791866195095). Extended validity to 2026-11-13","amount":500,"method":"cash","trxId":"CASH-RENEW-1791866195095","newExpiration":"2026-11-13"}	103.23.204.34	2026-10-12 15:36:38.730504+00
80	8	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10003","callerId":null,"expiryDate":"2026-11-09","result":"updated"}	103.23.204.34	2026-10-12 20:51:56.80415+00
81	10	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"shafikul404","sessions":1}	103.23.204.34	2026-10-12 21:03:28.16229+00
82	10	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"shafikul404","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.34	2026-10-12 22:09:15.986692+00
83	10	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"shafikul404","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.34	2026-10-12 22:25:48.321012+00
84	10	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"shafikul404","sessions":1}	103.23.204.34	2026-10-12 22:25:59.64084+00
85	10	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"shafikul404","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.34	2026-10-12 22:26:07.452472+00
86	10	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"shafikul404","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.34	2026-10-12 22:40:44.913626+00
87	10	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"shafikul404","sessions":1}	103.23.204.34	2026-10-12 22:42:20.133975+00
88	10	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"shafikul404","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.34	2026-10-12 22:43:09.362965+00
89	13	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"prodip1234","callerId":null,"expiryDate":"2026-11-03","result":"updated"}	103.23.204.34	2026-10-12 23:00:34.805398+00
90	35	admin	CHANGE_PACKAGE	{"message":"Package changed to 60 Mbps","previousPackage":"45 Mbps","previousProfile":"45 Mbps","newPackage":"60 Mbps","newProfile":"60 Mbps","newPool":"Starlink PPPoE_Pool","newRateLimit":null,"sessionDisconnected":false}	103.23.204.42	2026-10-13 15:53:04.230482+00
91	35	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10006","expirationDate":"2026-10-09T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":false}	\N	2026-10-13 16:01:10.242016+00
92	35	admin	CHANGE_PACKAGE	{"message":"Package changed to 60 Mbps","previousPackage":"60 Mbps","previousProfile":"60 Mbps","newPackage":"60 Mbps","newProfile":"60 Mbps","newPool":"Starlink PPPoE_Pool","newRateLimit":null,"sessionDisconnected":true}	103.23.204.42	2026-10-13 17:05:58.092098+00
93	35	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10006","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.42	2026-10-13 17:07:21.100392+00
94	35	admin	CHANGE_PACKAGE	{"message":"Package changed to 45 Mbps","previousPackage":"60 Mbps","previousProfile":"60 Mbps","newPackage":"45 Mbps","newProfile":"45 Mbps","newPool":"PPPoE_Pool","newRateLimit":null,"sessionDisconnected":false}	103.23.204.42	2026-10-13 21:57:35.352566+00
95	35	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10006","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.42	2026-10-13 21:57:40.2909+00
96	8	admin	CHANGE_PACKAGE	{"message":"Package changed to 45 Mbps","previousPackage":"45 Mbps","previousProfile":"45 Mbps","newPackage":"45 Mbps","newProfile":"45 Mbps","newPool":"PPPoE_Pool","newRateLimit":null,"sessionDisconnected":true}	103.23.204.42	2026-10-13 22:07:43.807085+00
97	10	admin	CHANGE_PACKAGE	{"message":"Package changed to 45 Mbps","previousPackage":"45 Mbps","previousProfile":"45 Mbps","newPackage":"45 Mbps","newProfile":"45 Mbps","newPool":"PPPoE_Pool","newRateLimit":null,"sessionDisconnected":true}	103.23.204.42	2026-10-13 22:08:44.932797+00
98	10	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"shafikul404","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.42	2026-10-13 22:08:55.341105+00
99	35	admin	CHANGE_PACKAGE	{"message":"Package changed to 45 Mbps","previousPackage":"45 Mbps","previousProfile":"45 Mbps","newPackage":"45 Mbps","newProfile":"45 Mbps","newPool":"PPPoE_Pool","newRateLimit":null,"sessionDisconnected":false}	103.23.204.44	2026-10-13 22:57:40.580652+00
100	35	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10006","callerId":null,"expiryDate":"2026-11-13","result":"updated"}	103.23.204.44	2026-10-13 22:57:47.32946+00
101	35	admin	CHANGE_PACKAGE	{"message":"Package changed to 45 Mbps","previousPackage":"45 Mbps","previousProfile":"45 Mbps","newPackage":"45 Mbps","newProfile":"45 Mbps","newPool":"PPPoE_Pool","newRateLimit":null,"sessionDisconnected":false}	103.23.204.42	2026-10-14 00:18:28.123689+00
106	29	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Ferdous Islam","phone":"01738204194","username":"10007","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-10-17T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Ferdous Islam","phone":"01738204194","username":"10007","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-17","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.36	2026-10-15 12:35:35.631589+00
107	29	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Ferdous Islam","phone":"01738204194","username":"10007","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-16T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Ferdous Islam","phone":"01738204194","username":"10007","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-17","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.36	2026-10-15 12:35:48.420836+00
108	29	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Ferdous Islam","phone":"01738204194","username":"10007","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-16T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Ferdous Islam","phone":"01738204194","username":"10007","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-17","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.36	2026-10-15 12:36:06.346383+00
112	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792104543199). Extended validity to 2026-12-13","amount":500,"method":"cash","trxId":"CASH-RENEW-1792104543199","newExpiration":"2026-12-13"}	103.23.204.34	2026-10-15 22:49:06.713977+00
113	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792105698447). Extended validity to 2027-01-13","amount":500,"method":"cash","trxId":"CASH-RENEW-1792105698447","newExpiration":"2027-01-13"}	103.23.204.34	2026-10-15 23:08:22.463861+00
114	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792107223843). Extended validity to 2027-02-13","amount":500,"method":"cash","trxId":"CASH-RENEW-1792107223843","newExpiration":"2027-02-13"}	103.23.204.34	2026-10-15 23:33:47.391082+00
115	35	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Md Fozle Rabbi","phone":"01710415717","username":"10006","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2027-02-12T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Md Fozle Rabbi","phone":"01710415717","username":"10006","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2027-02-13","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	103.23.204.38	2026-10-15 23:36:45.931602+00
116	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792107478550). Extended validity to 2027-03-13","amount":500,"method":"cash","trxId":"CASH-RENEW-1792107478550","newExpiration":"2027-03-13"}	103.23.204.34	2026-10-15 23:38:02.136047+00
117	36	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Pulok Debnath","phone":"01796730594","username":"10010","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-11-15T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Pulok Debnath","phone":"01796730594","username":"10010","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-14","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.34	2026-10-15 23:39:22.811237+00
118	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792107891376). Extended validity to 2027-04-13","amount":500,"method":"cash","trxId":"CASH-RENEW-1792107891376","newExpiration":"2027-04-13"}	103.23.204.34	2026-10-15 23:44:54.935293+00
119	36	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10010","expirationDate":"2026-10-13T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":false}	\N	2026-10-16 00:12:17.412512+00
120	35	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Md Fozle Rabbi","phone":"01710415717","username":"10006","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2027-04-12T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Md Fozle Rabbi","phone":"01710415717","username":"10006","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2027-04-13","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	103.23.204.34	2026-10-16 04:34:45.76055+00
121	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792125358151). Extended validity to 2027-05-13","amount":500,"method":"cash","trxId":"CASH-RENEW-1792125358151","newExpiration":"2027-05-13"}	103.23.204.34	2026-10-16 04:35:59.943779+00
122	29	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10007","callerId":null,"expiryDate":"2026-10-17","result":"updated"}	103.23.204.34	2026-10-16 12:35:06.993324+00
125	36	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-1792154787635-36). Extended validity to 2026-12-16","amount":500,"method":"cash","trxId":"CASH-1792154787635-36","newExpiration":"2026-12-16"}	103.23.204.36	2026-10-16 12:46:29.626307+00
126	16	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"ratanchandra854","callerId":null,"expiryDate":"2026-11-11","result":"updated"}	103.23.204.36	2026-10-16 12:56:28.567646+00
129	8	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Dulal Uddin","phone":"01714594628","username":"10003","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-11-08T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Dulal Uddin","phone":"01714594628","username":"10003","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-09","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	103.23.204.34	2026-10-16 17:40:49.408044+00
130	8	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Dulal Uddin","phone":"01714594628","username":"10003","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-08T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Dulal Uddin","phone":"01714594628","username":"10003","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-09","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	103.23.204.34	2026-10-16 17:43:27.099236+00
133	36	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Pulok Debnath","phone":"01796730594","username":"10010","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-12-15T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Pulok Debnath","phone":"01796730594","username":"10010","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-16","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	103.23.204.42	2026-10-17 13:30:28.796869+00
135	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792248435036). Extended validity to 2026-12-16","amount":500,"method":"cash","trxId":"CASH-RENEW-1792248435036","newExpiration":"2026-12-16"}	103.23.204.42	2026-10-17 14:47:16.876573+00
139	29	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10007","expirationDate":"2026-10-16T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":true}	\N	2026-10-17 18:03:21.616354+00
140	29	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792288673486). Extended validity to 2026-11-18","amount":500,"method":"cash","trxId":"CASH-RENEW-1792288673486","newExpiration":"2026-11-18"}	103.23.204.44	2026-10-18 01:57:59.359524+00
141	37	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792296269893). Extended validity to 2026-11-18","amount":500,"method":"cash","trxId":"CASH-RENEW-1792296269893","newExpiration":"2026-11-18"}	103.23.204.42	2026-10-18 04:04:32.61774+00
143	34	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"mithun1234","callerId":null,"expiryDate":"2026-11-02","result":"updated"}	103.23.204.46	2026-10-20 02:41:37.64426+00
145	8	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10003","callerId":null,"expiryDate":"2026-11-09","result":"updated"}	150.228.135.213	2026-10-20 09:58:58.459904+00
146	8	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10003","callerId":null,"expiryDate":"2026-11-09","result":"updated"}	150.228.135.213	2026-10-20 10:00:35.732188+00
147	31	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792593909263). Extended validity to 2026-11-22","amount":500,"method":"cash","trxId":"CASH-RENEW-1792593909263","newExpiration":"2026-11-22"}	150.228.135.249	2026-10-21 14:45:10.630297+00
148	14	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Tusher Debnath","phone":"01774036879","username":"10009","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-21T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Tusher Debnath","phone":"01774036879","username":"10009","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-21","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	150.228.135.249	2026-10-21 18:23:00.174239+00
149	32	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Tonmoy Debnath","phone":"01770708734","username":"1011","package":"45 Mbps","profile":"45 Mbps","area":null,"expirationDate":"2026-10-21T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Tonmoy Debnath","phone":"01770708734","username":"1011","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-21","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	150.228.135.249	2026-10-21 18:23:23.639132+00
150	17	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Muslim Uddin","phone":"01723250330","username":"muslim1234","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-21T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Muslim Uddin","phone":"01723250330","username":"muslim1234","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-10-21","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	150.228.135.249	2026-10-21 18:23:39.404771+00
151	14	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10009","expirationDate":"2026-10-20T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":true}	\N	2026-10-21 18:54:30.064473+00
152	17	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"muslim1234","expirationDate":"2026-10-20T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":true}	\N	2026-10-21 18:54:32.921029+00
153	32	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"1011","expirationDate":"2026-10-20T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":true}	\N	2026-10-21 18:54:35.760668+00
154	17	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792655625442). Extended validity to 2026-11-22","amount":500,"method":"cash","trxId":"CASH-RENEW-1792655625442","newExpiration":"2026-11-22"}	103.23.204.35	2026-10-22 07:53:48.763646+00
155	14	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792673798037). Extended validity to 2026-11-22","amount":500,"method":"cash","trxId":"CASH-RENEW-1792673798037","newExpiration":"2026-11-22"}	150.228.135.209	2026-10-22 12:56:39.551944+00
156	8	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10003","callerId":"B0:19:21:13:E3:9B","expiryDate":"2026-11-09","result":"updated"}	103.23.204.37	2026-10-23 02:00:15.328522+00
157	29	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10007","sessions":1}	103.23.204.35	2026-10-23 02:54:30.579155+00
158	29	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10007","callerId":"30:07:5C:D9:61:EB","expiryDate":"2026-11-18","result":"updated"}	103.23.204.35	2026-10-23 02:55:00.521095+00
159	29	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10007","callerId":"30:07:5C:D9:61:EB","expiryDate":"2026-11-18","result":"updated"}	103.23.204.35	2026-10-23 02:56:23.317293+00
160	32	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"1011","sessions":1}	103.23.204.35	2026-10-23 03:40:52.519656+00
161	32	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"1011","callerId":"BC:62:CE:0A:54:3C","expiryDate":"2026-10-21","result":"updated"}	103.23.204.35	2026-10-23 03:41:00.665554+00
162	32	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"1011","callerId":"BC:62:CE:0A:54:3C","expiryDate":"2026-10-21","result":"updated"}	103.23.204.35	2026-10-23 04:26:06.051652+00
163	38	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10013","callerId":"08:8A:F1:9D:1B:46","expiryDate":"2026-11-21","result":"updated"}	103.23.204.35	2026-10-23 04:27:55.114604+00
164	39	billing-cron	AUTO_EXPIRE	{"message":"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill","username":"10014","expirationDate":"2026-10-21T18:00:00.000Z","expiredProfile":"EXPIRED-PROFILE","expiryAction":"quarantine","gracePeriodDays":0,"migrationOverride":false,"sessionDisconnected":false}	\N	2026-10-23 05:25:30.336091+00
165	38	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10013","callerId":"08:8A:F1:9D:1B:46","expiryDate":"2026-11-21","result":"updated"}	103.23.204.35	2026-10-23 08:58:04.161914+00
166	38	admin	CHANGE_PACKAGE	{"message":"Package changed to 45 Mbps","previousPackage":"45 Mbps","previousProfile":"45 Mbps","newPackage":"45 Mbps","newProfile":"45 Mbps","newPool":"PPPoE_Pool","newRateLimit":null,"sessionDisconnected":false}	103.23.204.35	2026-10-23 09:02:01.033481+00
167	35	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Md Fozle Rabbi","phone":"01710415717","username":"10006","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-12-15T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Md Fozle Rabbi","phone":"01710415717","username":"10006","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-09-17","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"unpaid"}}	103.23.204.35	2026-10-23 11:09:30.823158+00
168	35	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10006","callerId":null,"expiryDate":"2026-09-17","result":"updated"}	103.23.204.35	2026-10-23 11:18:53.814632+00
169	35	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10006","sessions":1}	150.228.135.191	2026-10-23 13:24:26.840299+00
170	35	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10006","callerId":"10:5A:95:70:2D:C9","expiryDate":"2026-11-23","result":"updated"}	150.228.135.191	2026-10-23 13:24:55.77482+00
171	27	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10002","sessions":1}	150.228.135.191	2026-10-23 14:12:51.584872+00
172	27	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10002","callerId":"CC:2D:21:01:B5:67","expiryDate":"2026-11-11","result":"updated"}	150.228.135.191	2026-10-23 14:13:08.774608+00
173	8	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10003","sessions":1}	150.228.135.62	2026-10-23 22:08:07.049682+00
174	27	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10002","callerId":"CC:2D:21:01:B5:67","expiryDate":"2026-11-11","result":"updated"}	150.228.135.62	2026-10-23 23:53:41.189976+00
175	27	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10002","sessions":1}	150.228.135.62	2026-10-24 15:00:29.246133+00
176	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792870039732). Extended validity to 2026-12-23","amount":500,"method":"cash","trxId":"CASH-RENEW-1792870039732","newExpiration":"2026-12-23"}	150.228.135.178	2026-10-24 19:27:20.844315+00
177	27	admin	KICK	{"message":"Customer PPPoE session force-disconnected from MikroTik","username":"10002","sessions":1}	150.228.135.178	2026-10-24 19:54:16.792362+00
178	27	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-10T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-11","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	150.228.135.178	2026-10-24 19:54:30.827155+00
179	27	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-10T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-11","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	150.228.135.178	2026-10-24 19:54:51.225032+00
180	27	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-10T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-11","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	150.228.135.178	2026-10-24 19:55:52.042358+00
181	27	admin	UPDATE_INFO	{"message":"Updated customer profile details","previous":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-10T18:00:00.000Z","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false},"next":{"name":"Anu Debnath","phone":"01742671956","username":"10002","package":"45 Mbps","profile":"45 Mbps","area":"","expirationDate":"2026-11-11","billingCycle":"monthly","billingDurationDays":null,"billingExpiryOverride":false,"billingStatus":"paid"}}	150.228.135.178	2026-10-24 20:59:41.769319+00
182	27	admin	CUSTOMER360_SYNC_MIKROTIK	{"message":"Single customer PPPoE credentials, profile, expiry comment and Caller ID synchronized","username":"10002","callerId":"CC:2D:21:01:B5:67","expiryDate":"2026-11-11","result":"updated"}	150.228.135.178	2026-10-24 20:59:48.189658+00
183	35	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-RENEW-1792877207396). Extended validity to 2027-01-23","amount":500,"method":"cash","trxId":"CASH-RENEW-1792877207396","newExpiration":"2027-01-23"}	150.228.135.192	2026-10-24 21:26:48.542854+00
184	32	admin	RENEW	{"message":"Received ৳500.00 via cash (TrxID: CASH-1792936644960-32). Extended validity to 2026-11-25","amount":500,"method":"cash","trxId":"CASH-1792936644960-32","newExpiration":"2026-11-25"}	150.228.135.192	2026-10-25 13:57:25.808416+00
\.


ALTER TABLE public.audit_logs ENABLE TRIGGER ALL;

--
-- Data for Name: broadcast_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.broadcast_logs DISABLE TRIGGER ALL;

COPY public.broadcast_logs (id, title, channel, audience, message, total_recipients, success_count, failed_count, status, created_at, started_at, completed_at, worker_token, worker_lease_until, updated_at) FROM stdin;
\.


ALTER TABLE public.broadcast_logs ENABLE TRIGGER ALL;

--
-- Data for Name: broadcast_recipients; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.broadcast_recipients DISABLE TRIGGER ALL;

COPY public.broadcast_recipients (id, broadcast_id, user_type, recipient_name, username, phone, package_name, expiry_date, amount, status, results, error, created_at, updated_at) FROM stdin;
\.


ALTER TABLE public.broadcast_recipients ENABLE TRIGGER ALL;

--
-- Data for Name: customer_deletion_tombstones; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_deletion_tombstones DISABLE TRIGGER ALL;

COPY public.customer_deletion_tombstones (username, customer_id, deleted_at) FROM stdin;
10005	6	2026-10-09 22:40:59.46404+00
11101	1	2026-10-08 18:03:24.803989+00
anu1234	\N	2026-10-08 18:54:45.526095+00
arif1234	\N	2026-10-09 19:57:12.662241+00
dulal1234	\N	2026-10-08 18:53:57.128772+00
ferdous4194	18	2026-10-09 22:43:09.869141+00
nayum1234	\N	2026-10-08 20:20:59.676136+00
noyon1110	23	2026-10-09 22:43:01.193284+00
pulok1234	15	2026-10-15 19:24:36.501545+00
rabbi415717	\N	2026-10-08 18:54:06.538865+00
rajjak9732	\N	2026-10-08 20:20:59.508296+00
shuvo1234	\N	2026-10-08 18:54:14.106537+00
tonmoy1234	22	2026-10-09 22:43:01.555536+00
mun1234	11	2026-10-18 04:03:50.325699+00
durjoy1234	12	2026-10-18 18:22:07.874309+00
ratanchandra1234	19	2026-10-20 07:38:13.865879+00
\.


ALTER TABLE public.customer_deletion_tombstones ENABLE TRIGGER ALL;

--
-- Data for Name: customer_usage_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_usage_counters DISABLE TRIGGER ALL;

COPY public.customer_usage_counters (customer_id, username, interface_name, download_bytes, upload_bytes, session_id, sampled_at) FROM stdin;
25	10005	<pppoe-10005>	22938332980	1011464459	*80003D8B	2026-10-26 17:49:43.398827+00
27	10002	<pppoe-10002>	14232260621	852838925	*80003D89	2026-10-26 17:49:47.591161+00
29	10007	<pppoe-10007>	40914676777	2020269828	*80003D7C	2026-10-26 17:49:50.28885+00
30	10008	<pppoe-10008>	4102465928	92487603	*80003D85	2026-10-26 17:49:53.043433+00
31	1010	<pppoe-1010>	7603435306	240839212	*80003D7A	2026-10-26 17:49:55.565571+00
32	1011	<pppoe-1011>	3026347687	498011427	*80003D7F	2026-10-26 17:49:58.151648+00
33	10012	<pppoe-10012>	7859138860	2066277638	*80003D71	2026-10-26 17:50:00.863849+00
34	mithun1234	<pppoe-mithun1234>	7633560446	515386975	*80003D84	2026-10-26 17:50:03.475661+00
36	10010	<pppoe-10010>	52284368963	5550753345	*80003D83	2026-10-26 17:50:06.636797+00
37	10011	<pppoe-10011>	43361147918	1710863028	*80000292	2026-10-26 17:50:09.172205+00
38	10013	<pppoe-10013>	6273026520	204934564	*80003D92	2026-10-26 17:50:11.692668+00
26	10001	<pppoe-10001>	6120917017	137386655	*80003D98	2026-10-26 16:04:46.683765+00
8	10003	<pppoe-10003>	9246129060	222312112	*80003D82	2026-10-26 17:49:24.920633+00
35	10006	<pppoe-10006>	566880905	96334177	*80002A3D	2026-10-23 13:39:43.090456+00
9	10004	<pppoe-10004>	17178911620	804105633	*80003D88	2026-10-26 17:49:27.640136+00
10	shafikul404	<pppoe-shafikul404>	8729638180	378741809	*80003D75	2026-10-26 17:49:30.227296+00
13	prodip1234	<pppoe-prodip1234>	3234318991	262508815	*80003D8D	2026-10-26 17:49:32.784481+00
14	10009	<pppoe-10009>	51426320950	1439566039	*80003D86	2026-10-26 17:49:35.51602+00
16	ratanchandra854	<pppoe-ratanchandra854>	4412781617	117495479	*80003D8F	2026-10-26 17:49:38.052511+00
17	muslim1234	<pppoe-muslim1234>	37274906490	1898400384	*80003D8A	2026-10-26 17:49:40.879164+00
\.


ALTER TABLE public.customer_usage_counters ENABLE TRIGGER ALL;

--
-- Data for Name: customer_usage_daily; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_usage_daily DISABLE TRIGGER ALL;

COPY public.customer_usage_daily (customer_id, usage_date, download_bytes, upload_bytes, updated_at) FROM stdin;
8	2026-10-09	6930598934	296273454	2026-10-09 17:59:14.167707+00
8	2026-10-10	13652090374	541267394	2026-10-10 16:29:23.734516+00
8	2026-10-11	11054572765	838170853	2026-10-11 17:56:27.355601+00
8	2026-10-12	13516375921	508175875	2026-10-12 17:56:28.560259+00
8	2026-10-13	14285495439	535473929	2026-10-13 17:56:00.492917+00
8	2026-10-14	8162071440	353316256	2026-10-14 17:58:54.333129+00
8	2026-10-15	10994669196	437311914	2026-10-15 17:58:32.173794+00
8	2026-10-16	9027146031	358002435	2026-10-16 17:58:08.113221+00
8	2026-10-17	11867740559	469008243	2026-10-17 16:40:14.844977+00
9	2026-10-09	2543310588	292315202	2026-10-09 17:59:16.994371+00
9	2026-10-10	11991948355	871677040	2026-10-10 17:56:37.028593+00
9	2026-10-11	16591109088	1207119586	2026-10-11 17:56:30.6158+00
9	2026-10-12	36904845188	1801342532	2026-10-12 17:56:30.54474+00
9	2026-10-13	27898512167	1421981031	2026-10-13 17:56:02.948734+00
9	2026-10-14	17798724151	1060278166	2026-10-14 17:58:58.142921+00
9	2026-10-15	20572848280	1011643169	2026-10-15 17:58:36.05148+00
9	2026-10-16	15492581306	1415877103	2026-10-16 17:58:11.280891+00
9	2026-10-17	19754449920	1002198566	2026-10-17 17:55:43.631743+00
10	2026-10-09	1229361898	70019031	2026-10-09 17:59:20.011531+00
10	2026-10-10	11271702293	432535287	2026-10-10 17:56:39.930239+00
10	2026-10-11	5180233798	348110715	2026-10-11 17:56:32.686964+00
10	2026-10-12	6921259398	553720141	2026-10-12 17:56:32.535276+00
10	2026-10-13	9075770723	586209686	2026-10-13 17:56:04.967515+00
10	2026-10-14	9605765083	525794576	2026-10-14 17:59:00.208291+00
10	2026-10-15	8066445273	441842275	2026-10-15 17:58:38.066709+00
10	2026-10-16	7430997107	817804125	2026-10-16 17:58:13.895966+00
10	2026-10-17	13066274933	908223782	2026-10-17 17:55:45.603901+00
26	2026-10-22	18664413517	673527824	2026-10-22 17:43:47.715372+00
9	2026-10-24	14546728816	1317686279	2026-10-24 17:57:33.173605+00
13	2026-10-23	8040752895	153215013	2026-10-23 17:56:50.152868+00
9	2026-10-22	19260961666	1248259681	2026-10-22 17:58:44.560226+00
26	2026-10-23	6838161726	836064729	2026-10-23 17:56:54.239549+00
8	2026-10-23	7011033133	204604330	2026-10-23 17:56:47.460255+00
13	2026-10-10	14445311611	551190539	2026-10-10 17:56:48.62932+00
13	2026-10-11	19992060026	748073270	2026-10-11 17:56:38.864801+00
13	2026-10-12	16517436384	1717386274	2026-10-12 17:56:38.513569+00
13	2026-10-13	16156607367	640454987	2026-10-13 17:56:13.148368+00
13	2026-10-14	18939108766	702565056	2026-10-14 17:59:06.534498+00
13	2026-10-15	9574831889	400898599	2026-10-15 17:58:44.182064+00
13	2026-10-16	19921352868	872299443	2026-10-16 17:58:18.479462+00
13	2026-10-17	25560621020	1618572179	2026-10-17 17:55:50.655982+00
14	2026-10-23	50293788689	2006456272	2026-10-23 17:56:50.959414+00
14	2026-10-10	48519258438	3634007670	2026-10-10 17:56:51.422562+00
14	2026-10-11	55137872824	7140201161	2026-10-11 17:56:40.893589+00
14	2026-10-12	89325884527	9899506209	2026-10-12 17:56:41.641318+00
14	2026-10-13	55000415853	3245538140	2026-10-13 17:56:15.13433+00
14	2026-10-14	59654084197	3951991389	2026-10-14 17:59:09.621304+00
14	2026-10-15	52773875783	3041657753	2026-10-15 17:58:46.136246+00
14	2026-10-16	62224830680	4420137630	2026-10-16 17:58:21.666572+00
14	2026-10-17	40917127019	3362287330	2026-10-17 17:55:52.715729+00
16	2026-10-10	5426434015	189359789	2026-10-10 17:56:56.986361+00
16	2026-10-11	3589347313	116686907	2026-10-11 17:56:45.044466+00
16	2026-10-12	8637913730	285521868	2026-10-12 17:56:46.864045+00
16	2026-10-13	4440545501	154007836	2026-10-13 17:56:19.059895+00
16	2026-10-14	6336179481	211644427	2026-10-14 17:59:13.76346+00
16	2026-10-15	7031636822	231036832	2026-10-15 17:58:52.856854+00
16	2026-10-16	3854530811	124533958	2026-10-16 17:58:23.668164+00
16	2026-10-17	11405319411	364984091	2026-10-17 17:55:54.702501+00
17	2026-10-10	32889756065	1390575203	2026-10-10 17:56:59.799699+00
17	2026-10-11	28768283114	1209116835	2026-10-11 17:56:47.135898+00
17	2026-10-12	39229972105	1834790670	2026-10-12 17:56:48.885017+00
17	2026-10-13	35472409093	1486243988	2026-10-13 17:56:22.169961+00
17	2026-10-14	31492616332	1573936100	2026-10-14 17:59:15.820476+00
17	2026-10-15	34115271403	1915236198	2026-10-15 17:58:55.350772+00
17	2026-10-16	40422990898	1900063839	2026-10-16 17:58:25.777889+00
17	2026-10-17	44625297177	2263160150	2026-10-17 17:55:56.697882+00
16	2026-10-23	5699166658	186854433	2026-10-23 17:56:51.831385+00
9	2026-10-23	15743491940	2166437133	2026-10-23 17:56:48.484479+00
17	2026-10-23	50032854781	2031688029	2026-10-23 17:56:52.640395+00
10	2026-10-23	12423244995	628408223	2026-10-23 17:56:49.31055+00
25	2026-10-10	2345216953	263182773	2026-10-10 17:57:05.492967+00
25	2026-10-11	8888897508	901155841	2026-10-11 17:56:51.294869+00
25	2026-10-12	20004777379	1399032883	2026-10-12 17:56:52.913156+00
25	2026-10-13	16648754908	1093133477	2026-10-13 17:56:26.078997+00
25	2026-10-14	18277767186	1296995978	2026-10-14 17:59:19.919649+00
25	2026-10-15	16197259152	990752313	2026-10-15 17:58:59.31391+00
25	2026-10-16	19307711227	1311055165	2026-10-16 17:58:29.839744+00
25	2026-10-17	17406898229	1729362987	2026-10-17 17:56:00.711515+00
26	2026-10-11	21159867629	5108664726	2026-10-11 13:35:22.089821+00
26	2026-10-13	8987107132	1960247812	2026-10-13 17:56:28.046493+00
26	2026-10-14	8486806755	2256542558	2026-10-14 14:43:35.68067+00
26	2026-10-15	10317748041	951901607	2026-10-15 16:04:08.298811+00
26	2026-10-16	23404905710	7444479106	2026-10-16 17:58:31.835309+00
26	2026-10-17	23515468388	3258103549	2026-10-17 16:45:34.867642+00
27	2026-10-11	7833391608	1303086891	2026-10-11 17:50:13.637464+00
27	2026-10-12	17477132468	880830183	2026-10-12 17:56:56.564017+00
27	2026-10-13	22966161569	975539886	2026-10-13 17:56:30.010428+00
27	2026-10-14	15119546249	620058838	2026-10-14 17:59:22.509626+00
27	2026-10-15	27838071164	2072593999	2026-10-15 17:59:01.930767+00
27	2026-10-16	19571255203	930973792	2026-10-16 17:58:35.01571+00
27	2026-10-17	26058006174	1206976301	2026-10-17 17:56:03.264156+00
29	2026-10-10	28421630703	2201304114	2026-10-10 17:57:11.264557+00
29	2026-10-11	28525355638	1630257188	2026-10-11 17:56:54.532707+00
29	2026-10-12	34527569326	2360322681	2026-10-12 17:57:00.170801+00
29	2026-10-13	40211724615	2302090285	2026-10-13 17:56:31.969349+00
29	2026-10-14	35600228555	2274878488	2026-10-14 17:59:24.534066+00
29	2026-10-15	49551521026	3753864448	2026-10-15 17:59:04.360962+00
29	2026-10-16	53747049121	3071823740	2026-10-16 17:58:37.018624+00
10	2026-10-18	12890321042	1494612172	2026-10-18 17:21:17.185929+00
27	2026-10-18	12492840463	689244380	2026-10-18 17:22:05.697566+00
25	2026-10-18	15009261537	897628916	2026-10-18 17:21:55.639022+00
14	2026-10-18	39583189410	2215480596	2026-10-18 17:21:29.833329+00
16	2026-10-18	4350768433	122446825	2026-10-18 17:21:36.619464+00
17	2026-10-18	39660878804	2219425646	2026-10-18 17:21:44.635096+00
10	2026-10-24	14042185977	564063543	2026-10-24 17:57:34.393376+00
13	2026-10-24	15214988429	419253778	2026-10-24 17:57:35.223114+00
29	2026-10-24	41633849758	2613289962	2026-10-24 17:57:41.437548+00
8	2026-10-24	15445519441	434353267	2026-10-24 17:57:31.969034+00
27	2026-10-24	22473625733	1141172670	2026-10-24 17:57:40.500219+00
16	2026-10-24	8319789136	283785222	2026-10-24 17:57:37.045124+00
25	2026-10-24	24202830954	1552916926	2026-10-24 17:57:38.784766+00
17	2026-10-24	38673316739	2157802603	2026-10-24 17:57:37.949991+00
31	2026-10-24	5706119884	209564864	2026-10-24 17:57:43.077576+00
30	2026-10-24	6605587781	312230048	2026-10-24 17:57:42.368194+00
33	2026-10-24	11114764453	402718606	2026-10-24 17:57:43.999189+00
26	2026-10-24	15865066791	1074416321	2026-10-24 17:57:39.629994+00
34	2026-10-24	12863763424	504629844	2026-10-24 17:57:44.7401+00
29	2026-10-17	58753763405	3172198024	2026-10-17 17:56:05.246019+00
30	2026-10-11	6361081815	270741651	2026-10-11 17:56:56.603184+00
30	2026-10-12	10000327070	466467090	2026-10-12 17:57:02.235317+00
30	2026-10-13	6840773488	267964838	2026-10-13 17:56:34.45432+00
30	2026-10-14	8972293833	335756639	2026-10-14 17:59:27.046665+00
30	2026-10-15	7823180262	328210257	2026-10-15 17:59:06.32308+00
30	2026-10-16	9633965605	396862295	2026-10-16 17:58:39.001851+00
30	2026-10-17	8373546586	417489374	2026-10-17 17:56:07.22439+00
31	2026-10-10	2616608389	179887596	2026-10-10 17:57:15.734965+00
31	2026-10-11	1318811778	80100920	2026-10-11 17:56:59.221983+00
31	2026-10-12	5024485226	265674858	2026-10-12 17:57:04.213162+00
31	2026-10-13	6899720105	333854703	2026-10-13 17:56:37.627501+00
31	2026-10-14	2593011304	136279866	2026-10-14 17:59:29.168209+00
31	2026-10-15	1810552621	119922611	2026-10-15 17:59:08.31382+00
31	2026-10-16	5327434255	293800423	2026-10-16 17:58:41.009225+00
31	2026-10-17	10214371343	449810392	2026-10-17 17:56:09.205462+00
32	2026-10-10	652790016	103615260	2026-10-10 17:57:18.623963+00
32	2026-10-11	2068821696	234165400	2026-10-11 17:57:01.276531+00
32	2026-10-12	1193803841	322323097	2026-10-12 17:57:06.189643+00
32	2026-10-13	1987092795	288819138	2026-10-13 17:56:39.603347+00
32	2026-10-14	1294157415	118170238	2026-10-14 17:59:31.22792+00
32	2026-10-15	435594654	88197624	2026-10-15 17:59:10.311779+00
32	2026-10-16	6772824572	597501855	2026-10-16 17:58:43.596968+00
32	2026-10-17	4987796510	421582715	2026-10-17 17:56:11.17407+00
33	2026-10-10	3137933866	113129798	2026-10-10 17:57:21.497767+00
33	2026-10-11	11535391983	563419118	2026-10-11 17:57:03.432799+00
33	2026-10-12	25786445654	1090673490	2026-10-12 17:57:08.167449+00
33	2026-10-13	7729727984	421507449	2026-10-13 17:56:41.631774+00
33	2026-10-14	5599493587	303224388	2026-10-14 17:59:33.262498+00
33	2026-10-15	8214644647	402965053	2026-10-15 17:59:12.313737+00
33	2026-10-16	18712454045	3060381412	2026-10-16 17:58:45.560763+00
33	2026-10-17	19238510032	20102570480	2026-10-17 17:56:13.147967+00
34	2026-10-10	388641	272985	2026-10-10 17:57:24.437357+00
34	2026-10-11	4241114964	379237570	2026-10-11 17:57:05.527062+00
34	2026-10-12	7926166686	399503061	2026-10-12 17:57:10.149547+00
34	2026-10-13	8084903610	626067111	2026-10-13 17:56:43.669545+00
34	2026-10-14	4757517325	448167601	2026-10-14 17:59:35.322169+00
34	2026-10-15	4460259109	242471599	2026-10-15 17:59:14.31103+00
34	2026-10-16	7542948340	584953473	2026-10-16 17:58:47.559436+00
34	2026-10-17	7433251378	562328595	2026-10-17 17:56:15.126262+00
35	2026-10-13	961817985	74873117	2026-10-13 17:56:45.752929+00
35	2026-10-14	3378732143	794773936	2026-10-13 21:31:41.834839+00
36	2026-10-17	40680503619	2429052624	2026-10-17 17:56:19.317899+00
29	2026-10-19	53479588783	2961074906	2026-10-19 17:56:17.964379+00
8	2026-10-18	4907581486	153489035	2026-10-18 17:21:01.444161+00
9	2026-10-18	16642735304	736949279	2026-10-18 17:21:09.546231+00
13	2026-10-18	10961309287	964485820	2026-10-18 17:21:25.034989+00
26	2026-10-18	14168462730	621289831	2026-10-18 17:22:00.063397+00
29	2026-10-18	47308988923	3056932393	2026-10-18 17:22:15.628706+00
30	2026-10-18	11091780040	482334894	2026-10-18 17:22:19.950467+00
31	2026-10-18	13759421665	695356304	2026-10-18 17:22:26.702019+00
32	2026-10-18	3880232281	295403405	2026-10-18 17:22:30.996725+00
33	2026-10-18	36466027542	3787524066	2026-10-18 17:22:37.729861+00
34	2026-10-18	8398708978	711956797	2026-10-18 17:22:46.659152+00
36	2026-10-18	45521374494	2361750005	2026-10-18 17:22:54.203576+00
37	2026-10-18	9122757544	424068208	2026-10-18 17:22:58.410806+00
8	2026-10-22	11194578971	377947853	2026-10-22 17:58:43.123895+00
30	2026-10-19	6077490440	414898733	2026-10-19 17:56:18.736563+00
31	2026-10-19	5056251938	235309826	2026-10-19 17:56:19.564852+00
32	2026-10-19	3043435081	682047217	2026-10-19 17:56:20.331832+00
33	2026-10-19	26111367392	2622516698	2026-10-19 17:56:21.094568+00
34	2026-10-19	11995150731	951559542	2026-10-19 17:56:21.910468+00
36	2026-10-19	44416571081	3030581288	2026-10-19 17:56:23.014403+00
37	2026-10-19	10479880713	926047144	2026-10-19 17:56:23.898071+00
27	2026-10-20	12899819975	663369656	2026-10-20 17:57:17.981895+00
29	2026-10-20	48178576259	2870247853	2026-10-20 17:57:18.815632+00
30	2026-10-20	6829361039	303248383	2026-10-20 17:57:19.602234+00
31	2026-10-20	4393926737	771641180	2026-10-20 17:57:20.335491+00
32	2026-10-20	2777893982	338717308	2026-10-20 17:57:21.291866+00
10	2026-10-21	8643360819	604962016	2026-10-21 17:58:46.341827+00
30	2026-10-21	5059499684	336536389	2026-10-21 17:58:52.528783+00
8	2026-10-20	7370480990	243892486	2026-10-20 16:27:15.083214+00
8	2026-10-19	11245316561	342465805	2026-10-19 17:56:08.991344+00
27	2026-10-23	22058830998	2183643983	2026-10-23 17:56:55.121662+00
9	2026-10-19	15931657805	1317190437	2026-10-19 17:56:10.05323+00
27	2026-10-21	18800320873	1105103191	2026-10-21 17:58:50.98669+00
26	2026-10-21	8675137806	1866859378	2026-10-21 17:17:20.476859+00
34	2026-10-21	23101730936	1621291334	2026-10-21 17:58:55.589305+00
10	2026-10-19	6997981417	326585980	2026-10-19 17:56:10.805762+00
29	2026-10-21	48853103422	2635454346	2026-10-21 17:58:51.714247+00
9	2026-10-21	19226086981	1095074842	2026-10-21 17:58:45.544115+00
9	2026-10-20	19017480789	1015047115	2026-10-20 17:57:11.787791+00
13	2026-10-19	17075930965	551287301	2026-10-19 17:56:11.582217+00
14	2026-10-19	46652707927	2357153479	2026-10-19 17:56:12.346523+00
16	2026-10-19	6557136373	206437817	2026-10-19 17:56:13.26427+00
17	2026-10-19	28705116013	1905813499	2026-10-19 17:56:14.118116+00
10	2026-10-20	16329088490	715958953	2026-10-20 17:57:12.705727+00
25	2026-10-19	11405232668	1250313426	2026-10-19 17:56:15.589196+00
26	2026-10-19	10012694015	486585952	2026-10-19 17:56:16.354558+00
27	2026-10-19	11324555534	398463309	2026-10-19 17:56:17.127719+00
33	2026-10-20	50111953258	18636546772	2026-10-20 17:57:22.09545+00
34	2026-10-20	11269186272	756887319	2026-10-20 17:57:22.799455+00
36	2026-10-20	38920860211	2889665026	2026-10-20 17:57:23.833892+00
37	2026-10-20	16760240744	964658745	2026-10-20 17:57:24.644986+00
13	2026-10-20	5184412298	214346988	2026-10-20 17:57:13.445223+00
14	2026-10-20	41386881400	1799973277	2026-10-20 17:57:14.176509+00
16	2026-10-20	7211909572	183002704	2026-10-20 17:57:14.886555+00
17	2026-10-20	26064024319	1494662538	2026-10-20 17:57:15.685489+00
25	2026-10-20	16680783806	1350490792	2026-10-20 17:57:16.505278+00
26	2026-10-20	17198236478	2712967023	2026-10-20 17:57:17.244+00
14	2026-10-21	20580962806	1656755618	2026-10-21 17:58:47.793845+00
16	2026-10-21	6419901198	209186676	2026-10-21 17:58:48.539828+00
37	2026-10-21	18597315736	1054935241	2026-10-21 17:58:57.34299+00
36	2026-10-21	58425860764	4115382409	2026-10-21 17:58:56.526201+00
32	2026-10-21	252595597	107167312	2026-10-21 17:58:54.044157+00
33	2026-10-21	77568785603	3881705994	2026-10-21 17:58:54.844136+00
17	2026-10-21	32740501181	1571235307	2026-10-21 17:58:49.349943+00
38	2026-10-21	3464251357	117436017	2026-10-21 17:58:58.080729+00
13	2026-10-22	16289981977	793047539	2026-10-22 17:58:46.503763+00
8	2026-10-21	9754260448	257556910	2026-10-21 17:58:44.483865+00
31	2026-10-21	4073683659	977036784	2026-10-21 17:58:53.343046+00
25	2026-10-21	14382241937	890017840	2026-10-21 17:58:50.088557+00
13	2026-10-21	5163699398	370230406	2026-10-21 17:58:47.062563+00
14	2026-10-22	10162138435	311491971	2026-10-22 17:58:47.391313+00
27	2026-10-26	18274423255	980548170	2026-10-26 17:49:47.665101+00
29	2026-10-26	40956403679	2023992847	2026-10-26 17:49:50.362835+00
30	2026-10-26	4953710436	110029459	2026-10-26 17:49:53.117006+00
31	2026-10-26	7603442746	240841068	2026-10-26 17:49:55.639395+00
32	2026-10-26	3263977065	501972624	2026-10-26 17:49:58.225563+00
14	2026-10-24	61646378210	2688822160	2026-10-24 17:57:36.150428+00
32	2026-10-23	177920	475570	2026-10-23 03:39:33.594147+00
36	2026-10-24	57178379281	6191084694	2026-10-24 17:57:45.629091+00
37	2026-10-24	19849874142	780549203	2026-10-24 17:57:46.760344+00
38	2026-10-24	9233629195	339126916	2026-10-24 17:57:47.710076+00
25	2026-10-23	12840390434	825823394	2026-10-23 17:56:53.452256+00
29	2026-10-23	53907319648	3991684016	2026-10-23 17:56:55.909018+00
30	2026-10-23	5488604893	696929338	2026-10-23 17:56:56.742007+00
31	2026-10-23	8600143844	294861619	2026-10-23 17:56:57.551638+00
33	2026-10-23	17401964335	968250035	2026-10-23 17:56:58.589814+00
34	2026-10-23	9076359022	741335584	2026-10-23 17:56:59.380405+00
36	2026-10-23	63117812923	7181237305	2026-10-23 17:57:00.333172+00
37	2026-10-23	15953174578	615863009	2026-10-23 17:57:01.069197+00
38	2026-10-23	9464128159	347804149	2026-10-23 17:57:01.918886+00
10	2026-10-22	11346036925	689050605	2026-10-22 17:58:45.424012+00
16	2026-10-22	5377956784	160420885	2026-10-22 17:58:48.560751+00
17	2026-10-22	28073412042	2135744711	2026-10-22 17:58:49.314248+00
25	2026-10-22	13080071233	554389549	2026-10-22 17:58:50.194395+00
27	2026-10-22	23160022367	975045230	2026-10-22 17:58:51.554336+00
29	2026-10-22	41193262860	3208909349	2026-10-22 17:58:52.454662+00
30	2026-10-22	7099431975	288224080	2026-10-22 17:58:53.338247+00
31	2026-10-22	6115478528	290899902	2026-10-22 17:58:54.145787+00
32	2026-10-22	524257	3201803	2026-10-22 17:58:54.908125+00
33	2026-10-22	22508782583	873139019	2026-10-22 17:58:55.643593+00
34	2026-10-22	8665995910	547033773	2026-10-22 17:58:56.361081+00
36	2026-10-22	60137509580	3895148062	2026-10-22 17:58:57.293464+00
37	2026-10-22	8581896200	666623159	2026-10-22 17:58:58.078349+00
38	2026-10-22	7759650553	288907634	2026-10-22 17:58:58.90495+00
35	2026-10-23	973232531	160874375	2026-10-23 13:39:43.163412+00
26	2026-10-25	7458208812	359613125	2026-10-25 17:02:42.400562+00
26	2026-10-26	13143736445	386034288	2026-10-26 16:04:46.754739+00
8	2026-10-26	9253495599	226124918	2026-10-26 17:49:24.995424+00
8	2026-10-25	9641532165	319460690	2026-10-25 17:57:35.334566+00
9	2026-10-25	21366865346	1072442292	2026-10-25 17:57:36.092101+00
9	2026-10-26	17290818416	826365932	2026-10-26 17:49:27.714182+00
10	2026-10-26	8729742211	378806928	2026-10-26 17:49:30.301043+00
13	2026-10-26	3364728083	343111820	2026-10-26 17:49:32.858557+00
14	2026-10-26	57192924502	1565455013	2026-10-26 17:49:35.589926+00
16	2026-10-26	7311972963	196714042	2026-10-26 17:49:38.126718+00
17	2026-10-26	38275038869	1927988859	2026-10-26 17:49:40.953491+00
25	2026-10-26	23984867173	1160252381	2026-10-26 17:49:43.472438+00
10	2026-10-25	10234801355	760274956	2026-10-25 17:57:36.904056+00
13	2026-10-25	3508001687	342315956	2026-10-25 17:57:37.793046+00
14	2026-10-25	54910267311	1662817142	2026-10-25 17:57:38.606442+00
16	2026-10-25	8021851629	261986478	2026-10-25 17:57:39.32211+00
17	2026-10-25	34298927585	1926901729	2026-10-25 17:57:40.103349+00
25	2026-10-25	27454393509	1486910309	2026-10-25 17:57:40.932469+00
27	2026-10-25	16685376845	682363120	2026-10-25 17:57:41.934522+00
29	2026-10-25	41361510835	1888980245	2026-10-25 17:57:42.766276+00
30	2026-10-25	5483379168	184843393	2026-10-25 17:57:43.546325+00
31	2026-10-25	2796611976	121944887	2026-10-25 17:57:44.314495+00
32	2026-10-25	1434940725	182706893	2026-10-25 17:57:45.115629+00
33	2026-10-25	13791576964	469385803	2026-10-25 17:57:45.890229+00
34	2026-10-25	17155835229	778441573	2026-10-25 17:57:46.678669+00
36	2026-10-25	59177865981	3254620174	2026-10-25 17:57:47.680155+00
37	2026-10-25	12398202110	577166744	2026-10-25 17:57:48.479684+00
38	2026-10-25	7532535820	251629863	2026-10-25 17:57:49.270276+00
33	2026-10-26	7922483764	2069872070	2026-10-26 17:50:00.937283+00
34	2026-10-26	8074944557	531805783	2026-10-26 17:50:03.54935+00
36	2026-10-26	54779792315	5714876861	2026-10-26 17:50:06.71031+00
37	2026-10-26	12664556243	414080773	2026-10-26 17:50:09.245788+00
38	2026-10-26	6784216247	229921382	2026-10-26 17:50:11.766567+00
\.


ALTER TABLE public.customer_usage_daily ENABLE TRIGGER ALL;

--
-- Data for Name: email_outbox; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.email_outbox DISABLE TRIGGER ALL;

COPY public.email_outbox (id, idempotency_key, event_key, recipient_address, payload_ciphertext, status, attempts, available_at, lease_until, provider_message_id, last_error_code, last_error_message, created_at, updated_at, delivered_at) FROM stdin;
1	0543f6ed-1dd0-4602-b741-c7e950663978	renewal	fozle5207@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"AKSuU8E1QLOnB1+q","tag":"qelbaVUIa4jkYXOxZumOaA==","data":"NEw2zHyECtv9EJtT+UeT/+pm4cq3MLDd4BpYaVsGDVpV2ns8Cz4ORbRPgU8o/ipxJwOJFWaJMtFcCRIUwJLvpO5yXm6uvPGwRx/eD5ZoE4rVQcEnDJtcKcV8t3zC4KDZOO0RQgY8I3kVTKJHQ7wZMurYUwixohr91RTj85kbxp6aCDmAoIkB7V6YY7WajAGyCrUFcy2RNQGXoIoT/RBlPUH65HO/craL67HiglzqvZPQWcSkol7pvYDZeRZRByPPmxyFlVZd8wXUVgAzy6wAfYbYaJgGDKDvbODJ1r0RStICl6uXeIsXAP6g1+EYaB3PtDDKMFr2mZhvZxtFZx6RcCCzNjAnLpJ02Lr11bDE7El3IiS7r2ps4p2t/0iogtckYiWzTPcjXjrwPPxpaGD5RifZC1/AlA04mokyrOQhP3Wzn4/Ho7CYVaG5OTUWcY2rO/h9eiye5CYKx1X6KisHofGX2oOu0uR1FqXJPhQc0HLWgX3AJjsIQLjga8e1VyrossYFsPJrRIcRJiGrDjHmwDDGngO5lutZx9Krn+YEK1zqmLxxhmvaasNKM9TYEDiMl/1KV/r3w95frsB0rW8h4exSpHud5Gj2QTNAfc8cHatgOXwzRsBWhHcX+7mw9XJD1hONWZEdZjcdMtgfLpWMGimFEKEj4XHHuATF5YehvBV1GVhJwWrIfaz8Y5+ksKOvZpP8uGUHPpTJMFWIXzNU0VuDlP/MtYVAS3t8NsOlehZ7rezRROShAtmQZaiGnZv0wz7qEIVqilgJ8RWI1Xm33QCY/J+h+Qkfr7kmyhbLkbrls5Dvn+fdgffHcmVSGYK1Nj5ioJkLgmcjutvP4wMYyaEXba9b7VVWRhsk//wjwjUacUjoln+yW3dkEbpWvjdu+pnSq6yx1i2jFSzaNG5d2zYqMYFd7ODrV97M0MWapEYFJSsxh10MpITGm63Cwoq5LxC+GOsHxtxriAXCYLA8t9WR4nmWBbKpm2ifDFoXbkTny1qP9xUK1dbaBE+RS6UFdDupulhvgKef4rrZOssUfsjZRTIhLyplK7dVjlhIvhnSkQYrVt7G5lY6lmAWzPtKYPNvNhx2aC+4t3wjX3A/1/E82b/N4n4Q5HO7w4Mnckngr6+ylSB2hdk5Sp47JGjajnHewf1VGHZsyyshuh0QA2g8i0bDsCvUds8h0srNp7OxSL8M9yZh6tIetF28SXicEdMWpSN3gQxE8DvrFc5c7OjZi3F51F8loRieQpZmaOcLQdulXMwpnq7Ypz8p0c9lP+vLgScTUb9rMMc4AmwTdLPHOADwQcKV3iDnTObYSzwHFbHdqDemD0pT8nAiFfdc4NwufdrBTFV7H0evKgwtN/JYsdZiaLkUGRBRZph4yjRbNhdysj88SSOVkHkTeY6uvF8+fiHbRRn+4DBDF0nelJNisBtFfFvicC8w7+eZNC3QwKU="}	sent	1	2026-10-24 19:27:20.974+00	\N	01a16f61-db98-7229-b7ed-b5d07055d088	\N	\N	2026-10-24 19:27:21.08586+00	2026-10-24 19:27:26.903074+00	2026-10-24 19:27:26.903074+00
2	admin-invitation:9	admin_invitation	fozle5207@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"qzFZ0btnTkuPn45E","tag":"c+Yw/22vbybAnBFHOOAYLw==","data":"ZLSViw9eh3Pbgi8+QH6OWmIQoJ4CrULboIgeDBrJTC2CtbxtBrc2WYvlEEeXC/LyUSPXLz1h53ObPLKZJ59iTC+WOu1ZwOduAd8VSYYVnlTbXZa8jQLGLdZPMnIeCIz929ztggAtDzlP0Dpllk+BqUHtGyDHUijH9LQa2RrA+L/wNTR93BUC+VQfbARrSwcjr5rLfP82Iym/FMLTuJgyd8Yt31sc5KByPENw2jMtlfu/uKH/34HnRrd2u4QhqyrXFAQM7Jz5zlY1cebw9aonbmb7X7dOcKR+f7G+DlTuEScF39FLSSWft/GFX+/Yr1BqdlP3Q44WR2wum0lt0iU4lv1Y416jG6vbfEk/xNBQ1YyVJ0b+fJA9uyKuLKSYBQcDnKlO41dG03DweTdQoS9LI7hVsnszZ597J5aCfmG31b09V9VckUp6JBLSim7f3ys8VWP16Kl1bV+94a/1ARYaZiYFnc/q3/P7U/RDEDJBb/Ru98R0/ZpKOQw+UqyasBWxUoWZ0zSlezmqJHxhJIO9XG0QzzRAFyhrW6rkx5T8jUTSkm9+6q1LdkStpnBgYY7vmZxQmWEsPy0a23HvE1tq3dnYW9CzPY2x7QbrADre3VRMDYa9eeGtbJ97wkb/3ufMHbxcpPd6hrrFyTJAr2Q67CPcTDiAuj79ZZvQsmP0R49WNmGVQujBNn7ChNhwacoCUJ4hYmFEKLU76dN8xxdMUsOP60S+4C/XpdBoHJz4gn2hQx7dWzrnJCuVDs4hOGenRQNtgE0duer/Ixgl4qzkfnwuGpNlER4wDiGgr6QqAO2HLvj3Ub+C9XTh89bsfB6jy7pRpF/M97kC66PxEbh0P8vXZkFhyeAFXtFa7u14OYwcrVYcQjGZbm0Q5B9cVEONWfMeiHYX/trsrH3Qqpf27CuQ6VeU14CjvrRtvnQZJJhB8DycMG4ChpiuI3fEZTGo7gIunX3em+OpVf9/aEHaSemkk1UwzX1G6QuBzELSu48VisB8kze25S+NDwqOjcuwXefbKHW3Xoxzhk9KsZHF9yG3klvQVqfvR2uy5dc3zDn0/zQwzZwv0QsmvAv9Fjoh2MVmFJFfy3famgUqlFkra51U5bKp1r3xUD3ymHmzx9n3wh2kP2dMm+iuN4OQw9gSqeR7BXfJfspnUlM//sAJlfT68EfDDJrg4ujur4cSXnBi40yjA1JPVZNrpMb4mQaqjtyBnFXRI3Zq3peJsCmxRUgNoT9irIjsgPapfgPSWljuDPr8gHfw+P62KHiEpbgALw4ilL87aJfn5DrMcJ/tiJ1BU0HhYYoOZXq8ZlnhQUMwIf5ipFxUJEJKqY/uBxhZkpE/asABnxxhodEOIPyIf+F8/6SKS/5tKWynP0QgomYLzxXbXUxJM4ha1atkOKg7"}	sent	1	2026-10-24 20:19:07.53+00	\N	01a16f91-3928-76c6-93e6-ab7bf4303d07	\N	\N	2026-10-24 20:19:07.158899+00	2026-10-24 20:19:11.068544+00	2026-10-24 20:19:11.068544+00
3	admin-invitation:8	admin_invitation	fozle5207@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"h2FRj2C2Aco4QVdz","tag":"OdCeq0dF5obCPYUWbklH4g==","data":"S5YV/J88tm3Ahl2IGjAjEHdbKIofmiKH0eaGjltMw00IjoioxLX1FWuIqYr5/cluKfXP32ECic0X45CMt8jx6ZgWKenvDTUljnHWYW3+fQgmb6ne0hLcCrYsVedACOoc4QpEJT6wc06jtRjIYslbzOPqieK7CWIWTkLAcNLBvN10wSySX2MA9LbY3D1WwRyZljOYQAgTICVYzbUHBU68OAv9sWEvIvKy2crIJFsJqrBIiE4wyyFHVLU9lBacJ2NrlWaAC87bqcwVMT/xMn/D/yduQpMlxq4c/lxGHXEVvfOxAA/R/WWVvmhE6PeeO4XbkG7AtbXrDS2AgM4GmizaLMtNIpIubWV8au48dJf1nRjssWITfol6iQhsnIuHpQTWMYgjAfwMQrlxmwFKZpZu0RWT3Ytytry5DKwsX7fBB3gQg/52nyWdUT+07A8wUcOurD2WPEY9+FLj+j//MVWpvIZTJu6UdQFFyrzYYqBXunBx9RJIp8fADnZBaKTmhRa45uiPvNsxvJvZp12vOcMNfGI5zorW5c3ElGdqmT24pr78jhakWXZeUG+dhbRHjuYSIS3n92j2xqL9mIKxhmfRVPgGX7n5Y3b81JVfCdCrDj2M/Wp03SEOtBOQ3sHeJjTKlkAy7GW0o6GKVBraffX2jrYqLI+IgJunlNqwugRQeiXTOlOlSbtpeBozSVaaZnJ46vb4vjc60l7fqL1e7XhLnkModDxdMaYPRYiVQ3X6btDEKp/YMZjWHnFOeol0S+XZ2Pt9fiidJoYJQ81Pd5wS2X9Fno/YEdUXEsn4cyS2aYs1I3qWtgeKbjywuPC5t5OQgV3qEztW2+Sp1OQjikBtTbK5Zor+r9V3trmKaD/luAJCH34IeyC0YzxNRIsiIifNmkqbKFMZm9G59FxSlci2A00fqo2dpLUSf4qoSBAhXQldb1lAqzDcDt/59c83oQed5VjP5k/h+dA7LpX4NwjsA46ehn4Z0i4bOhloEV4oB2wR2oy1/BEc7S5DRVPcVYOyi2w8B4Zro7N7RRfk0zGiSSA17OThd+Hs6G2RtRme9aUo5oKT+bavl8NmXznTrxZZHSQ9VCJoVMrYEhV3E6uxfzzMiqrG4WtCD5/zKNz8321CVd7iMBwQ/wuf70RdA0idVQebOzSLK9LJjpK7RZIJgSG8PBGpzdOeH54hLSDQ26iyovsXH59DXmoGF1MH0QqjeNEtyeavC2tHfTA9pxQsNbFEIYi5lDrOGuTj67e43jozc0y30IinvrNeHomeKbbxR4ZFelYJsfrw7/i5XweWtmgnadKYsiiyD1taWm0AofajuzXGmubNYOeFANK06s4UKVo17OhufGzot3s6yxWZTF/Vt/WIJNvONrijAM0AYy6RxOvFYNd6C/dvWYMzpwH5"}	sent	1	2026-10-24 20:24:58.527+00	\N	01a16f96-9113-71ef-becd-11c6d3fb6848	\N	\N	2026-10-24 20:24:58.203501+00	2026-10-24 20:25:01.225355+00	2026-10-24 20:25:01.225355+00
4	admin-invitation:1	admin_invitation	fozle5207@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"xiTXRYIVmwfeTQAP","tag":"tbqhODC1pgZPP/eYTiwdFA==","data":"QjOWFTNnqvrh1m4p92iD5wycNgcHJE8ocHuS0N4NXFmf3GAPtPVXz9+LfIHliZ21rko4U2IrngM3++X9efUggP5ugAN/twzefU7yE8Av3v2jTa14sMFti2RmkEWnM/TpiVOEh+vL9N6vPwRhjCEOMjTcM7nmrUj913bAqp6ASfzZOsei5XXcA9lSvq75V2CsFOfOKe8xM3hQS9YS3bZukMesRLX+5nfQ+K7BxPfcAbvtldIIdnekg6QeG/E/pq8XxouyyPqDgD9/WrZNWX9QKBtESwA2MPGCM6+tI/C/bratHLZ5ZnllmaUeBXDGsLd1p/YaY8Fjb8+p8dmU7x8GLKrxvhI9dmdBpT1mUKFMSMPeVv1BmjDeUuSoRAsS6cE7JFuKyIt9jM5DKrrZdI/sJ2todQdc5T7RjRuTQbZnyfphlEw6vb4nagGOHmdhSAFcP4ZYFAfhmvs0nGzmSaJdq6iI3NqIbZF9PuPGuVHkZirHaH0igVTO98v0OHiKAxIWAMd/o9VOSdXxOlFLw7rhtBmo91cRW2pMefgmPT+MuDrbUQl9c6ZcO0qm11Al8PUUthmuiTfhOxSWVGOtW9ADkqsLTX7fR2m6BQGTjXc2ptHxcvCud7qeVo+99rKoIZUKZbpeM1ZDt/UjvK2H9JhBosbAa0+PnqzsR2h/7qciwYz+018gDMDKA8jThDMmfmXeZ1/pKBJUwb9LuAHBOAGE5C7RbXRSoO2It7CLF/TZ85HSZ3J0CUGRsfWbaXeSrv3FvAJpEmoLXsruT6ZA02JwQC8xomnLKxeoOIwDPulv1I/BQf2dEhrJGYgTkh7419AynAroiX4uUoc1iTTBgoJQYgiYLyq6hLVBQOpcZY5n3wLVnk6stxitqPV1Oxve1ZKTd889Au/bCuRmlDI7Wmpfh0bnLjYk0yWFUVySg01mOwgORqo8DUW2MUhKFC7rhVTEKkpk8djFUK8cFX2m7gfT3iP8/AGxXJwf129M6bIz8NzocSaZL4EW75c178DPZresEYDTxNLcH6+QgdLJaaNO2P02NoAfi/D8bCk19TRW47nyUPPr0UuBGQdMTYwMrRwQ1osQRYOS4O4e0N3BrvnJYZLb+ABNBqE551nt+AfqZNNhDw/q4fKuL1oUncm3rRsJLiMWl6vstY93G5iIZhQWCMgh+FSFKcNXDfaVR/cn4LZSxH9+Emf1iapSG1dOMOWPAXLoKjJFtCkUmmR8yX9+MLLxvNFFKoknmiHkZOFYGC+6z0nSaFoXMPYpRVlQq+5fKvGNITzx0D4SRHWYxdaYCMV3hjziN20oA53HWl68o1DnkqNBsHt0eL8M44tlhm8YKFI01N0Cl+l/"}	sent	1	2026-10-24 20:29:37.12+00	\N	01a16f9a-cbd9-7dd5-9921-ccc1136b9943	\N	\N	2026-10-24 20:29:36.793739+00	2026-10-24 20:29:38.425436+00	2026-10-24 20:29:38.425436+00
5	admin-invitation:18	admin_invitation	fozle5207@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"Gcvq8a77ez4h08vh","tag":"Ir+e3ME8HUcaAzIbSPle4g==","data":"PDWBRx8qoy5fQxzZQ1/9g5iL1u5IDDJHt+7pFFXzd1UJKZI1/QqvKHJm1YZB4AzX1z20+538/AWzL/IpoW3sqZGJFa+Z8aH24vWvEN0mRW92oyDCMmxhXMSS1iEm/PqtF2sVwFM4emmHEfXin1+M+63myRIDzkd+2A+GyGx5fjXTSuTygtzuGIXK/Ifcc4qvN3MtcZOMqoqv3UNiO/OPEBP+XoI4aVRTKdIG8gzZHYo0gF/1r6vrfWGL1SrtdRZZrDPMGdouOgg2iJWk/qXxDB9kKeYpV1GRxCnVFIp3N1yTkQMo1r0DRKqmJEsf13hXvvORVy8EnOkKg/7HZ7N1P6bu2TR0Jk72DUnLoOnhBQ5wqD+HTFnJON8PrnAvWwHDjHOAV7b2YNqLDy+vbN62c0cxg4wY2vPB13zGpEuzdNLXEbHGpKj1cTxFnvW0rab+337+/SPt0i3Gt+J+ahtLL0IAJ0VOGdF3UprB3fWpQSyYi1aJrsCEcIKSw6s/4t9Cwq3nGe5wzcw56hyXfqPuxgzJLIWZOd7fDYt2hzC2waIAw7cno6bmTWMLK6vXgGFjFRPsqmiE6pgTYgbOPl4CzYf2bUTUJ9HJZngcD3pt9BS0GnbaIrvJCEb5DKaldLzFVf1JkECZr5dgijAh36KENSsKa6sBbSH9UxqxiE8zBd1F4HO1tNPOu1ICOFolJrZXIwdoUOBadh5e6qgWNhppac+pHTdCCk5Y7mRJnrmH/Qsu+bxi29wVercyHubOrWPkcwHcR6k/IZUH9zaoVvrqdYRhsR5v8dnO7AWDRWlDb4q4aiWtDzVynt7PHvB4+9UwvZHYkxdUHJ9GmFy1/nV6iQcZh2NdI+kPvw/c6m3NCrYqQtzeJp9DeDYyzh9sJ1jeSF/g0TPAMYmeytbHtfQZcKtfXaSr55TFFeBbsfJS1Cp5d+/rz/mBkhH2EKW3qGywJsau4B7iM+TmYRA4LvHpEABFHmQBptiz6wYnuiVBTuBifyfSRa4CH4jJt4PgsclEf3QobeGd698x96OnkqOh2JTsbEo03FzkhiScFZBFTs7YJ5/vlh1zUHWTbJtYwQf4G5J0IsDlZaWOTaSGEZUZORu8s+iDIK9qup8+jRMQvYk0K7MNMb2GB4+bh/7mySSpmcKkIcASD0Ow9NCtOIWOKXlQeQ4s8u0LkpxdGnibG/nugmvjqIsR/sypcE4bLs0Fel4mqeAkp03z5N3DqZF0a05D0JMk0aBNvOBa8itmDpllpmh25p9JGO6Tc7l8CVmIqOlNjIlM9DTfBFNbrXgnvIwe29+SDZGteSIzl5CP9w3pctPSXDs1knssipG317RktYoTABeGOGsGTDwZtg=="}	sent	1	2026-10-24 20:47:34.081+00	\N	01a16fab-4138-7e73-86a3-922061cb94dd	\N	\N	2026-10-24 20:47:33.747795+00	2026-10-24 20:47:37.070213+00	2026-10-24 20:47:37.070213+00
6	admin-login-alert:11:1792874890846	admin_login_alert	faznetwork.com@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"QBoHh2C+78krdmOC","tag":"YFJzacNUZK99H6kneqy41Q==","data":"QDZodZFIyX3FhW/mIa5AZnhomii7IEQQ6MzaEi7wBO5jsVza1qNa353Gu64CH/MEq7fzxPTJgHPYyrnMFKra9NEuEvLUiGJysCw09E6gAclaeKATNMdUIesX4ZOIcZZZ6cX7vgpmQEWvMdAhujihVhrEcJ8Z4ao5zT31ESGI0YFK3nN/XCbqLSIieqN7Xsc1FY0ORT/QZhezPvXXWw6RWHZzc83tjEHAn1qLxpXkbktSaOWBk7vJw+hN+rG5dEGnjsD74kE5ZRk2u9LfgY9sCuMYvdCGWSOA8vIwF83EfgTyxQWRc9UKun1oZzMiplTqFl95XDpnMhGkoIhcBlgoMZi7LuqF/oN1SdzzwXB5G4hZVQAKXIiMWDIjes3pxUc21kYiSOMVOvnWi/7kn4L21ecA2/6pEqxWcDQV1G5RVrwqrVikqu9HsL5CAJkCv8aUGMo2SxF1owjHPLKdzflWY5EWVfPCER7rbb7O+grCiVAaJHFBR/ByYlY1RlAVr1i92u4ScQglPVo4R2CWdIGbWyuS1m2A1ZueloCVJkW7NN9FKTSaKK/5srIRydBmTi//W9ZL5/ZKhLx68/NZ+SGPwp7viTnn4tiY7us979ljPdLFIauq3oNZ5YP3D5XgGxyYw2Q+0EHlc+48ewqUNWoZcfz0gSTMI6vIm6OpBIRwvzDT+VY6B76VU6IE1547sB/8VlfTFEIpJgMjAHc6MgCbqQ0eusbNDAvGY+7NwOGMxZd16BOvja9XHqpb45fpmyl4wUEHpjX5qBSCcQgIM2tsbm8MdvSTq8GKTV6czwDsT2CtJS0S5wih//mvq+OExzpo6ZWFJoD7H7u3gedAHlfwhG82v0t+QU8t2Wtc9hXr2SFiLLqFEldahkncjTDT+acc18Y5aVhx0myFGBjqo1cC9p4Ex3D89LBWPWzORcq+VOf+V3uX28YEGZyJDQOsdM1WTyUHV8Tvqm67FGfccujRI8chmAhxgUJqa/pTMYBM9iKEqPB8COsPjObpQ808TZ8meBrbhtJ4a2s5BTbl39MefRZ4EJ+AlZSF6lFepFQFAKQPXgZRXA8AFrCkQwAK+yBr7wDZAXQpWNwyq9aQZCQoUkkkgXIn5I7rQCilnR1rO8e83A0T6DxGj5ads4F7D9a6skGBlaOTjuSV+0U0fKNq2wPl8e9UVW3rKjIm4pVRzML6AVa/EEA="}	sent	1	2026-10-24 20:48:10.847+00	\N	01a16fab-daaf-71b5-a7f3-43b635abb9fb	\N	\N	2026-10-24 20:48:10.958643+00	2026-10-24 20:48:16.340852+00	2026-10-24 20:48:16.340852+00
7	admin-invitation:19	admin_invitation	motinmir.vision@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"J6zW8ciOKXaY0oAA","tag":"m+f8KwYuZL77lIS4zOawPw==","data":"xFuMDX9zrWshJpehCL29icrEpPTxFliYr9cVJmuSnrUn/p/MlDyzK+HnE2XNScDSGTSAfL1C+4BO9W4Qrzfq1HjfPvzVKqzy/P/qJYbG34oWOTJCq5ydYTV9R/+RDtMnl1VM/7rhtvDitZaOj3MvhrTZqagVHHI5JiAe6u0m5cfR8kyiRDIauS9BvuUxi5F/b335qz72l2sT6bSB+RGfJD8dgWvcXtApUYmBUMty9wdk2aR/lznle5ZMowR4xkI9epe+dgvcw8hWDMHXzqPHPc942gx9zPkWFLA4/gm2KNt48BT2NXAYajwTegLwE88TzznMZSGVxvG/1akVEmRmeB1Dpz7UogXas26Qs5REjay4+wTVUGnekfcQkLWrKJHjsUr5igFWRhlb5bZOVXLXyBIiW8tuo0npVDnUkZN3xAMYW91x6yWO/LVDQdH2/JjGnNs+ojdRzpTFZrf4tMxc/Yf90O3kmKHS1C9dvhq5wDIqA81k+34dILAAWe8OceXFUCPMP7w3l7o3Mb6Cpm4bUH6QGTSQlHQVd4Q7lCEJqh04aK1OaWJblD9a4u6ECR7FOYS+t5r3F2IODE7+MYbPqIy9eMmN4Ba1vBE3t1pr2yjtdWBX8A+J0UZk0ujFOyltQxHBuLlF3qTOFNQmi2TqdNEymux35oiURQlgCQU3PSSuIAxFqcl/xk5K5c5ydD95+ZZHuNRwhy6mQ8dTjgP5YRtfVFsUhvAZ9Jgzihx+3EoM/ZWScdr8Bicdw1cx8237QZw/VWVDSMVPWLaVoChcg65bz6NAHqQ/FaekfeX8/Aq2L7iVjblwyArCYmboLz/YYz7h42DXap6Axr5ZUtHQJQPj6cSpKyJOhaXUXLdPQ+ouV4IBqT7F5h8i6ffu605fI0JdKq1VqJ7sehQnyhFnseu1U2TTtHRGsdJYTamkSyXEWqJc2LxxnnJ1hR6JXnQCQAAvjLeMXQh1fk2iHfWUA6KFYm7B+NAJ7sVEhSQHWbNlmexnR11lX7O58khuce+YlfXZMRvTVxILlWVbiRguXs3FeCM2CNcqo07tSUU0UV0XzxE049Wawx+aR4Tndl29JGLXYkP+tCV3EjwsUb6kHzegwKX3t2DjSHZ2qb8bimmefOiWKFAms+02f0bVb+uvzcXGNu+3MUfCa/vUou3DfJyJ/hSoI4KVJoa5ZpoLOyH6BdnccBt5O6YRTeR5p0j2cXtmpmRSKy2P8b4QbF8Rj3+vRMOziqXvVYWq8YexrzVkskccvncNbJrGRVYA5Yod7OVk0IWtajySArPvWKy7qccrdcZa7ndb8x/yQNAbql9mqCVtTJheGHT70hqeiDvGXICkdFU6EgU5lbjt48foTkQZaA=="}	sent	1	2026-10-24 20:50:11.395+00	\N	01a16fad-a451-7a2e-9b72-0502ddf1b3e9	\N	\N	2026-10-24 20:50:11.065755+00	2026-10-24 20:50:13.481878+00	2026-10-24 20:50:13.481878+00
10	admin-invitation:22	admin_invitation	motinmirsagor@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"331hTrhIb5ZsK6Ih","tag":"Wh3ufEsNXDIsalNSx2pUVg==","data":"dinuwB4D9q8b4FOkm0QTliOxXBS+VVftck9bHwr7ELZrgf2Ml+DrK/fDAfYlP2XcGpTJJwmAeE5Wo/5bwPgL46/YlRlItDUhScKMzWLWzc8ySRoWhUwye+vcdM5PCQ/DzicIsqCV+d4yb343IjMzz9vskOJ752QYC/N+pBUBKBr9piRA7UMvkedHktMZEWD9+H7T0yvAp6rwgD0NhhzwwP84weJEtIBDKSCWQm+c691aaSsVG+zyyTMiBLGBoiOJ/CvPcHz1Sokn/14Q7R9ocPyj+YE2a0KmCAgXrpU+42ze0xXNl1i0YAD1ZpmmCDZnnbYDcaTP4j16udi2zekbCH2pxJac799/CuSa1ZuNUxNLla8/BDa5K9E4kbFkz2td7WdQFqInnx4cG9G50LhZwfS3hSlEXNWacGeMk0hTDBDEniVyFA4ucL8z5r1jpFKWMo56knRMiWrGvUUMeTsIn4jy+57uX6S523eT1lPz6faGKvwnt88n0IUu06MoL8kN7GAzDxhiIQ7BPFVTaxIuoorsX5cQPWXDILHz+g05NoHS+RU+hc9fX2ZtndSXauxpIew/0ifTLfvL5ADkNCvd5nehG52kLyEimqmJyzFgc9zVpD1ecSt+iiNSYbRLsAQetiT5KdhergXawqrCgXaKcttTMSvkeiqFU5y+e248hgYx/ZG782Egw2LMHeRIoXkih+q9tNrUWO+JINyjOYW5sMOG4J9/0zAoOlHZFsrTJdRVh0/AnWHIMNxysORhYCJnHUzJu7iYFoqQEYv5+69k6nSbYWXOID6bROhFpZYQo3vJMipRIC+tMOPfXL53iVTiUcY6cWxKsDRTf36PrI3Vff3GiWkVNRRVUCL8s0W/g2rN+fZhUDdAO+c8+VGaTEOjzxtzKL9BAvREfb7Ua+xMWqqw68paTwzmHx/iTxzQvbO2iXRsNVJMpix8YV6cTPEsthMobWWl+x7tJZN+LYRs1XQ5Kio56ZIEL3R78+TyQO7A3LOPhijQ1tgUl+aNOQTEZonsGxOLkSxyJXQRzRTBquN6FOlWsf2iJA36m5+iY1BlDE95UY50h+WarOzGcKOq0wWwQEacHEpe6yp3a6T0UUbARHYiLOgUpa047uTQHhq/nHzSTR2rXyin8WWuwW/9eMGYXjqAXpOAVUtcVzXdrq4+wlRkbJZqULifczx2x9tbPyS2350HO+p7n9yZNwvhWcegPQ82hycxNDHElpbeR7NQxchbQ+kts7yRLvhwdokCqKgnsqEzJ8BMV33F2gnFnJ66a71XvN7OAb4zs2HPQNdTOKRuo5yhtMx1GZm5DJ8AOA/yGcNmcCKmc9r1f1xbL1R+IOBObmb5mfP6YL6XjA4F81lpAcJ1V+I3NCqSIfv0"}	sent	1	2026-10-25 03:11:56.061+00	\N	01a1710b-2e57-7a47-85d3-e764110c4ff8	\N	\N	2026-10-25 03:11:55.738218+00	2026-10-25 03:12:00.89358+00	2026-10-25 03:12:00.89358+00
8	admin-invitation:20	admin_invitation	motinmir.vision@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"xaMY/nonyfq7BbDX","tag":"pxNE4053yJ0mbuZnkcl2CQ==","data":"mVOmIxYWz8tXAYSgJS5/76htcx8V+QHANhG+Nm9WoMNESXvguCRjv7ZpLBdfEpmz11V3RfoEUgt6SF2DCbUa9YOKIacKLxVVZFPmcx0YkUvzpW5heCi6C3nxfaPUpH9g+JMa7eDUuwXGlIIYtU8/HeXZnzY29r12qARreGIlcZX52F8wFDt3OOra6oToFpzvP8q+ol9S1LdiZ1Tu3RCayAEakOTagvsWkgrPZcrfAMzbvMdifWZJKqvvnUAs1VcN/2XhhG9OFMnGh+q31ijIHZKq5TuCtHfDx/jgpfYD4EyPQMzuzgnUogrum0mABJ2nZaSqeWVmVHlg0YYlVKUih3fIOSpEvNXSNkl6O8MLvzdFuy7i0/ifnRkDZwenBfKjUKlHGF6YRXsUzZio/Kz4tk9as2T5lZ79wslyVxkbeIqT3HMnOKO6iZTBU5th1J3fIWDi/AP6NJe0FdQ8aimKKJksojv3590+t0/PkkdjOoe3n6pD9QZVkBqzJxA8qB25sYhzCjDdsmIs+ogfK1mTDJjGN6eRk6Ku/SDbWZeCzATxlPgrJkdG5qeWNvCXAQRFWwL4exJVqYy7NEPE7zeEAncK5q2zzDCrGOduMHLa5Y7kVior5VOzbcMVo2VesmyNvHWNFmiM0IEUqDPk876RBvrm6VXmo//CJCt1rJuwzixwybAOBMv3C+TP2GJAmHjkHxpfN/tsgQWrB9ZEqKEvyCd5t/aSy2ogNsyTG+kDsKCrg/SnYKS/ArpcwFGxtwVyXPbwvKdx69/Pap95hVeJk2Q4izUweLIrIOlGPLvTZe08g8LkoCxRDrsbnNZvH19oefU82Y6iYJUYnhtYQ55a10D/p8GtBudvSZZiP0vhWWaGLMn3nF0OQHPoWwPuVjzpucXNgsaPqJscbk3oLhBmBr7HEuVLPCiLrheIY2RuzQ5IzTshQkubmP8UF09JZ5YR4gTgkV8xEOwEF7xYsAWsGd3UAHz58uY/5PDJnKuxgevuZ5QRebGdn+eGGvu4wTYGGH8i+GwpIOFx46DWPYDdNa/SQUdBYOvzsdvZUTE9DkOncI3dgorhYqBtU1ZFTPHgXD3vhqvMryf2rO4k9inCRzr8IlPvneyy5fx5aYsFhZuMvd4QqAguodxMA/c0jJrAJ5CfRkPZEM/jhOzRpStdMZm2skMi+8Ioa8ahbuRJ8UbibQzLXdc9w48Tb3ftoS/baSDC4BvIch5tXHeDezwZ9pFUpA+1uA8uE+dxtFsthUEC1UNw9BglJMe4y4ohESdkyi/1UpcYwUOdW8Y6BDL7n9I8ON4tDC07YHiCM05BFD7Vbdtzgizo+6NKkDXxQINo23QSMQOD39Z64LKqdYtj6Hrgy7qhkKpLd8FIHztTK3kB6eo="}	sent	1	2026-10-25 03:08:29.461+00	\N	01a17107-fd56-72bb-a627-00799e20df0b	\N	\N	2026-10-25 03:08:29.129965+00	2026-10-25 03:08:31.767059+00	2026-10-25 03:08:31.767059+00
9	admin-invitation:21	admin_invitation	fozlerabbi.official.gmcservice@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"iVAFxzbSyexTW1Sh","tag":"8Q1ZUcPMqWvB80A2+LPRfA==","data":"4lLd7rmgGwZ+YDxTmqfOF+sGgTI8EZDqzsS77OjrfCdH8fGYgu+4VfhSrnUtjqOUhFqZsn5DDAHFzmcaUSNi210AUnyJ5mPgZjH5JW8VEGgyMiQXX6M0yMIHIgfJnJqGf8NQ8smLiCr3pMriaCBxxhBJFMAMohB15RmWZSzG3DdRQBy8SRRWPG5z54SCEMo9dJx57VtpVgxAP98paLvern3r8JV5Cr5brTltL127yvxTXIBZizrt8BHlu15+jEQk8WcroyjiIOwS9RQwfHkjgmfrAWQ/Lwg8x9W3N4myrjW2uZlcD+bT5xHIKMing+Ph4tlrp1xMsAYL2/OsAK+6BPNpMWEeVEhVanpik80Fg7fHJGuRdXM6wo1yPUlQbGaJthBILKKEDHi3eXQR6fTmBQn+/2F7/Cx3AipssN5BXf6GwXlP747ClUsrYTTFjNbvFf8TrIOwTIxVp1wETd5m6Z1g+Z+1GHMrmfU3AakezR/ZIIJnSULT9DXIftihOfMRFp96tN592PSRvPtCm/rFq9CnHBZ6CBmZkQMs9SMsYVSBIjflfXCaR4vJpZ+PvRoht1tLyPIM7kzytSldix9EQyQrdQmfGUkkezUMRfcGZEKdKiMvOW8WIt7swAAjOZPfmu08bcR0s2RzBYcFdZVpe++ESzHKZvPUZ8qJfjurOyXwRS5ZE2aUhneXefoM+JU+mb29pMDzpx8LpjBM1KnLfgz9n5K6tDrxUMzCudaxVHej1yRDIGT9KhhRlOWRLWTSgtlUUifYUPOF/Go80P6DxLUB8GeVQYn0MB+FArhpv1XHXskOHhVwIsaVez9uBcSatWg/p26fS0Cjd2am84B6k/+uu1ORJTK/N6+ETLM5moodB2JtIALMwaLc1yZOSlIqavQxjD+9R3i5TXPSjGUVmd9cj0GuS13N3QbMGyk5PAdFVVfqMmuZDbOi2NXsyLNyqe0V06E4aLU6Rn5DzgmYNq02G+1Uclt71vgbO1U8+GaTady7VULkLnAa7uyQOvAQLSL57pGbOlsoEZTTNYilNQfXoeOfE48WPb7qJgcR21CRIdt72cvfsdo5kYwG0ALcaX4wtZ77WZ4K301L+eacBAXrK1dhFya9Ls6Mj5Kf6tdRG/DsZesL5Kur72fTLRU8fI+iFaTYFV23REm+xIjH0u7NrygDCMWs8VSG3SQFy2Ckcuff6I5eLN5aulnUl3AbCL+lT/kfYnA0DMT53YI210bEqs9boNu/+k+2lIb6rv9Ut2daQN6EIvfXRbai0fni4fluyTnB+BYd5GlRwkpLJvDfHQgkxRTAGVH4pwKGuVEp6eS0MrRiGk6vCOgH9jt77X15z22odSVtC8oSLh413PGsXO+62f50CG4bcKHe/ZiHnI6xH1+y3aiEJeXvua1Zq7E="}	sent	1	2026-10-25 03:09:56.573+00	\N	01a17109-4dab-7a33-826f-e2e24e909316	\N	\N	2026-10-25 03:09:56.250478+00	2026-10-25 03:09:57.847381+00	2026-10-25 03:09:57.847381+00
11	admin-invitation:23	admin_invitation	motinmir.vision@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"S7oyFo0cXeAio4bV","tag":"WvkO7dnKwqPYzotubcVFQA==","data":"EwvBKNMOgF7Y7fsvvS9FQ1ZZKbGXINqPbyfaq1xRTNvbTdd5x1KK5f/dERxicRvtWXw5lOe6LigucDYj/zSpaxM7ubCPuWEw4Ik4FZLlQC11xs/Rlg87ETQ+n6Zx9PfzioraOnHpIhky4PHWtRGulOUKS0C3lpsfFO8wJhB/VwEW2KYb3TE/5s0fjfDMlXwVSo1pQuph4gnCnZdqOji9OlHax+82+nCO+Q3vzpzdsI+UcyBWawEakcQgdTtDVWeohbQRV6l17ux+zJ0jpBRSjD/AB0J2OtIOiyKjiW5/bcJ6bh99CGD7yPeh97aTrtxfXl28ZqissMFrFfVnEvMYrfwguf+pXT9sB0fyEGqaFe9RBLYX72xyWlB4qZ2B5CwgGJXOhVvCR2K1GO2eogNTIwL+ycwRrFWyWFkYX/EUHglOtvZTXLMRWiWj0HHGtB86rIN29DXylrNEXpUAJAMQXtxTlr9wO18cxMAcA+o8B4nIQaHcET6OfHa/buDaFIz5FCdJcQSBJHP7I85+4TkHvZZNyOL9CW+iSm44C2lXJs2ztWGrUrHD+82AH7W7KwDSbhKq8w3QsTKjB4c6HFJBs6eb5zGIz6yrm1BkoJBHP5xV+CMvU332sPihO2pq8MZObieYIcMdpgAkZJPF6bg2qbqHQJOFcQsAKltRKl83z+ejEYs9GD/e48f66u8KG13KO2tN8ULkaOHgPMe0j5Xavr8ZjXZ15yG+kCwx1QHGbSNhPjVTQe6gbOQ7w/EnfDqXyCfLoCnYdykgASNH1Zxufar65SXnFIWk3CVhHpQ9tTqbK3C/ERwKelFYqF6c2QuEetoVJ/aQTXo6mdOXEKgim6QaxdCJ7Hg3C85HNeqEADk1butjI41ZPwmigfyEpIArz/N7G5io9QXNFG+itWg4Cnac7wXzdPYJH2Zc/XUgxKxAVqNg9hENi88WKrlBIUFOzhBrj3BaLwFcZtb5IYCmIyK5DssNP9vTSKSqfMEoKL8or4X1S2TakxLn+Ia870HKIZ+Wo2SZlf9mBMZVUWV5D/H7tF9S66lgL9l+fZaSEfstlYrikEzUBSxBjc7gXsapLbBSiNVoQ9NWGeWph5PHGvbhE4FB0n7ezL47PgKsLiJ7adwy1BefQBE780VkMgV3SRno1Nkff9d7TEhlVD9YSyYUrzBNKN78oUvW9J8WosxwqTTs0iftS0L/Wc3cO9RnjO6VAEZJwxTL3CzBBilkeN+DvB7fICbaF3hhfU6vIPhUGFtiCB6Cu/Ci02cwLZr363ZeU7eLl3B33XMB51COQoSgrSkgL8eZhZonXVe5ZJfDWZVuDQ8aoRNr99QN1sHskEbKNNoY00Cx0T/ApZAuSSHBufGddm82PHWx/nztaAnp0kA="}	sent	1	2026-10-25 03:14:32.93+00	\N	01a1710d-89bd-7c96-9597-a1d32a3f1e94	\N	\N	2026-10-25 03:14:32.593267+00	2026-10-25 03:14:35.352976+00	2026-10-25 03:14:35.352976+00
12	admin-login-alert:12:1792898113527	admin_login_alert	faznetwork.com@gmail.com	{"v":1,"alg":"aes-256-gcm","iv":"0vhCScmxp68ttR5u","tag":"4x9Ht8+3zaF8DLSCWoCqpQ==","data":"hkO3kz0OH+MJeI8MEsWKppCvrgmnKpZFNCkdM1Dbi31AIrAlIV5dqHYTiHmY6Mtq1N2kcsW4uX7DMbRFaKW4H/H0Zy4qoKbyrtctYbQ5h+8aoMaw3eoxwMEhY1N72sZbAzRES88NnU9Lz9LG1QLtxaStu7w3wXMaTBownHDmPGAr833/lA2xYW6uxJO1lK3uS11aWaWQuG9DS35sxBCOhh7fypjXHTZBe3Pk6YcYaNpwxObhp6SAod1+XvahHtODnbeJnoi0KByDqaPH+BiXHvVvRxwBQd8wa5n5cSKA0SeyuHaVvCyxR0HGFhLbnzL4ePZxnHRSAJYfhGHbtcnMHceKPxH/bWlKRFbnogyn3zDTg7PSWToKH5ejLsGiMnMcCTVmgyHO0+omV+KPSrm3beQpN1T1YBk2nMp8q/NaB8cc3srQEXfALoPZoqWYWLlZI7lEVLhQZND920AH9e3dbPxr2KfKTajMA6zETEfz2Q949ZXLlETDnU2JBx8r8sF9JLwyXmdKUsK/CjAYe9jDg0CgHQHmePOrvYgb5eO6wklLiXIeT0kTImYDJ/FtDUu5vcaF7J8kRwm2RwTWFHNuMquHSFco0o65pzas0A68glgvSRHr9EZmvOn7amq6Xfa14XvKvq0yDJ57z8sMLlUikLUHsu6e/51KfsRRM7InnlWchcwT8RwJo/AfnploGnwWxaUgCwpY+DdF/46oZySWxx1MivWyo6wI1nySl728Bk0UHNIiM7JJLqF7rM2lEQBvQ9Zw8bYEp53zqv3GxquuTmPY9wIzUkE8tJPLxdt/H+2jfnuI6xGSZr/N/m3vPR/uDYs16X1RbKiwlXINbzLWEXxjkADkwzYqdVLGnWVZB7vbRvZ0p/K98VctcG89dWFpdxFt5fkg+cxTlGEZWuHgRgETZ9kMAKwnZPVHw4xcyb6psvbzMQI0nghYc59pTlz/TXONH2ZKQLd4r+VnMIzS1y5R0jk/c5zuQZb0L2zfwCmx/CEtkdHRk/1v2lX1OKv6DLkDFTWdVmLGSvVhfCrwkE/tiy8i6AlCC0w+SLJDIN9cN5oFJyVBzG3PnvYvTxb/gyWLyExJM9Huc6sJf9WCMtgKRDT/h1HATlvGp6BmmBUGHlyDRhiB1r0gFL126xWd4DKnh3gXv4Pg9sVTNG9j+bFOgXgrSllbqFUwHgeOcOP2qrwa+lQQXRKwoqFaYConbEVVdfsjnG6UcI+XxilHS7rfC9qlTw=="}	sent	1	2026-10-25 03:15:13.53+00	\N	01a1710e-355b-7f0d-a37c-3f99ecefe900	\N	\N	2026-10-25 03:15:14.055484+00	2026-10-25 03:15:19.28815+00	2026-10-25 03:15:19.28815+00
\.


ALTER TABLE public.email_outbox ENABLE TRIGGER ALL;

--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.expenses DISABLE TRIGGER ALL;

COPY public.expenses (id, title, category, amount, date, notes, created_by, created_at) FROM stdin;
\.


ALTER TABLE public.expenses ENABLE TRIGGER ALL;

--
-- Data for Name: hotspot_ip_bindings; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.hotspot_ip_bindings DISABLE TRIGGER ALL;

COPY public.hotspot_ip_bindings (id, mac_address, ip_address, customer_name, phone, comment, binding_type, package_id, bandwidth_profile, expiry_date, status, router_binding_id, last_synced_at, router_sync_error, expiry_processing_started_at, archived_at, created_at, updated_at) FROM stdin;
\.


ALTER TABLE public.hotspot_ip_bindings ENABLE TRIGGER ALL;

--
-- Data for Name: hotspot_portal_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.hotspot_portal_settings DISABLE TRIGGER ALL;

COPY public.hotspot_portal_settings (id, display_mode, banner_url, custom_html, notice_text, brand_title, brand_subtitle, helpline_number, redirect_url, enable_online_payment, enable_voucher_pin, enable_qr_scan, updated_at, portal_logo_url, default_user_profile) FROM stdin;
1	banner	\N	\N		FAZ NETWORK	স্বয়ংক্রিয় হাই-স্পিড হটস্পট জোন	01339932887	https://faznetwork.com/	t	t	t	2026-10-23 13:00:54.060478+00	\N	
\.


ALTER TABLE public.hotspot_portal_settings ENABLE TRIGGER ALL;

--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.transactions DISABLE TRIGGER ALL;

COPY public.transactions (id, channel, trx_id, sender_phone, amount, status, matched_username, raw_sms, used, created_at, claimed_at, claimed_by, claim_flow, needs_reconciliation, customer_type, sale_type, service_type, reference_user) FROM stdin;
2	bkash	DJ96MN930E	01710415717	10.00	processed	01710415717	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 65.02. TrxID DJ96MN930E at 09/10/2026 04:11	t	2026-10-08 22:11:11.294467+00	\N	\N	\N	f	\N	other	hotspot	\N
3	bkash	DJ90MOCXDG	01710415717	10.00	processed	01710415717	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 75.02. TrxID DJ90MOCXDG at 09/10/2026 05:38	t	2026-10-08 23:38:18.820125+00	\N	\N	\N	f	\N	other	hotspot	\N
4	cash	CASH-1791558151981-9	01611939732	500.00	PAID	10004	\N	t	2026-10-09 15:02:37.030187+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
5	cash	CASH-1791655313704-26	01764867748	500.00	PAID	10001	\N	t	2026-10-10 18:01:57.289968+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
6	bkash	DJB1Q96K1T	01710415717	10.00	processed	01518473368	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 85.02. TrxID DJB1Q96K1T at 11/10/2026 02:35	t	2026-10-10 20:35:23.973682+00	\N	\N	\N	f	\N	other	hotspot	\N
7	cash	CASH-1791687761973-30	01716832502	500.00	PAID	10008	\N	t	2026-10-11 03:02:45.516154+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
8	cash	CASH-RENEW-1791691153996	01728541854	500.00	PAID	ratanchandra854	\N	t	2026-10-11 03:59:18.736464+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
9	cash	CASH-1791726278337-27	01742671956	500.00	PAID	10002	\N	t	2026-10-11 13:44:41.886392+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
10	cash	CASH-RENEW-1791866195095	01787805753	500.00	PAID	shafikul404	\N	t	2026-10-12 15:36:38.72835+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
14	bkash	DJF40MNPCC	01710415717	10.00	processed	01518473368	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 35.02. TrxID DJF40MNPCC at 15/10/2026 00:06	t	2026-10-14 18:07:00.149971+00	2026-10-14 18:08:30.434131+00	01518473368	hotspot	f	\N	online_mfs	hotspot	\N
15	bkash	DJF70MV3NX	01710415717	15.00	processed	01710415717	You have received Tk 15.00 from 01710415717. Fee Tk 0.00. Balance Tk 50.02. TrxID DJF70MV3NX at 15/10/2026 00:12	t	2026-10-14 18:12:46.787345+00	2026-10-14 18:13:28.011787+00	01710415717	hotspot	f	\N	online_mfs	hotspot	\N
16	bkash	DJF90NDSQJ	01710415717	10.00	processed	01518473368	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 60.02. TrxID DJF90NDSQJ at 15/10/2026 00:28	t	2026-10-14 18:28:15.1246+00	2026-10-14 18:28:58.818051+00	01518473368	hotspot	f	\N	online_mfs	hotspot	\N
17	bkash	DJF20NJKNC	01710415717	15.00	processed	01518473368	You have received Tk 15.00 from 01710415717. Fee Tk 0.00. Balance Tk 75.02. TrxID DJF20NJKNC at 15/10/2026 00:33	t	2026-10-14 18:33:51.281785+00	2026-10-14 18:36:08.448049+00	01518473368	hotspot	f	\N	online_mfs	hotspot	\N
18	bkash	DJF30NW1RZ	01710415717	10.00	unmatched	10006	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 85.02. TrxID DJF30NW1RZ at 15/10/2026 00:45	f	2026-10-14 19:00:53.63236+00	\N	\N	\N	f	\N	other	pppoe	\N
19	bkash	DJF60O1MNG	01710415717	15.00	unmatched	10006	You have received Tk 15.00 from 01710415717. Fee Tk 0.00. Balance Tk 100.02. TrxID DJF60O1MNG at 15/10/2026 00:50	f	2026-10-14 19:00:53.802878+00	\N	\N	\N	f	\N	other	pppoe	\N
20	cash	CASH-RENEW-1792104543199	01710415717	500.00	PAID	10006	\N	t	2026-10-15 22:49:06.710982+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
21	cash	CASH-RENEW-1792105698447	01710415717	500.00	PAID	10006	\N	t	2026-10-15 23:08:22.461304+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
22	cash	CASH-RENEW-1792107223843	01710415717	500.00	PAID	10006	\N	t	2026-10-15 23:33:47.388927+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
23	cash	CASH-RENEW-1792107478550	01710415717	500.00	PAID	10006	\N	t	2026-10-15 23:38:02.13369+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
24	cash	CASH-RENEW-1792107891376	01710415717	500.00	PAID	10006	\N	t	2026-10-15 23:44:54.93295+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
25	cash	CASH-RENEW-1792125358151	01710415717	500.00	PAID	10006	\N	t	2026-10-16 04:35:59.94179+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
26	bkash	DJG53NML79	01796730594	500.00	PAID	10010	You have received Tk 500.00 from 01796730594. Fee Tk 0.00. Balance Tk 600.02. TrxID DJG53NML79 at 16/10/2026 18:41	t	2026-10-16 12:41:18.474226+00	2026-10-16 12:41:18.474226+00	10010	pppoe	f	\N	online_mfs	pppoe	\N
27	cash	CASH-1792154787635-36	01796730594	500.00	PAID	10010	\N	t	2026-10-16 12:46:29.623999+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
28	bkash	DJG645F5QQ	01710415717	500.00	PAID	10006	You have received Tk 500.00 from 01710415717. Ref 10006. Fee Tk 0.00. Balance Tk 500.02. TrxID DJG645F5QQ at 16/10/2026 23:20	t	2026-10-16 17:20:54.812587+00	2026-10-16 17:20:54.812587+00	10006	pppoe	f	\N	online_mfs	pppoe	\N
29	bkash	DJG345S623	01710415717	10.00	unmatched	10006	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 510.02. TrxID DJG345S623 at 16/10/2026 23:29	f	2026-10-16 17:32:15.365493+00	\N	\N	\N	f	\N	other	pppoe	\N
30	bkash	DJG346DXW5	01710415717	10.00	processed	01710415717	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 520.02. TrxID DJG346DXW5 at 16/10/2026 23:45	t	2026-10-16 17:45:57.81597+00	2026-10-16 18:24:24.947319+00	manual_hotspot:admin	manual_hotspot	f	\N	online_mfs	hotspot	\N
31	bkash	DJH847ZG88	01710415717	10.00	processed	01710415717	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 530.02. TrxID DJH847ZG88 at 17/10/2026 00:35	t	2026-10-16 18:35:47.47701+00	2026-10-16 18:37:09.043469+00	01710415717	hotspot	f	\N	online_mfs	hotspot	\N
32	bkash	DJH149NKN7	01710415717	10.00	processed	01518473368	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 540.02. TrxID DJH149NKN7 at 17/10/2026 01:48	t	2026-10-16 19:48:17.476908+00	2026-10-16 19:49:19.627833+00	01518473368	hotspot	f	\N	online_mfs	hotspot	\N
33	bkash	DJH449T0K2	01710415717	20.00	processed	01814237287	You have received Tk 20.00 from 01710415717. Fee Tk 0.00. Balance Tk 560.02. TrxID DJH449T0K2 at 17/10/2026 01:55	t	2026-10-16 19:55:35.222968+00	2026-10-16 19:56:07.720675+00	01814237287	hotspot	f	\N	online_mfs	hotspot	\N
34	cash	CASH-RENEW-1792248435036	01710415717	500.00	PAID	10006	\N	t	2026-10-17 14:47:16.87446+00	\N	\N	\N	f	\N	scratch_card	pppoe	\N
35	bkash	DJH95MMNRZ	01710415717	10.00	processed	01518473368	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 550.02. TrxID DJH95MMNRZ at 17/10/2026 20:53	t	2026-10-17 14:53:12.983818+00	2026-10-17 14:53:43.178209+00	01518473368	hotspot	f	\N	online_mfs	hotspot	\N
36	cash	CASH-RENEW-1792288673486	01738204194	500.00	PAID	10007	\N	t	2026-10-18 01:57:59.246526+00	\N	\N	\N	f	\N	other	pppoe	\N
11	bkash	DJD1VNC7ML	01710415717	300.00	PAID	10006	You have received Tk 300.00 from 01710415717. Fee Tk 0.00. Balance Tk 385.02. TrxID DJD1VNC7ML at 13/10/2026 21:51	t	2026-10-13 15:51:19.336949+00	\N	\N	\N	f	\N	other	pppoe	\N
12	bkash	DJE70AA5S9	01710415717	10.00	unmatched	10006	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 15.02. TrxID DJE70AA5S9 at 14/10/2026 20:31	f	2026-10-14 14:31:35.410841+00	\N	\N	\N	f	\N	other	pppoe	\N
54	bkash	DJP5HXK4KL	01710415717	500.00	PAID	10006	You have received Tk 500.00 from 01710415717. Ref 10006. Fee Tk 0.00. Balance Tk 1,610.02. TrxID DJP5HXK4KL at 25/10/2026 05:48	t	2026-10-24 23:48:52.649947+00	2026-10-25 00:11:30.734976+00	10006	pppoe	f	\N	other	pppoe	10006
37	cash	SCRATCH-52-1792290213067	\N	5.00	processed	CA:3E:69:AD:93:A4	Scratch-card redemption for voucher 52	t	2026-10-18 02:23:33.115782+00	2026-10-18 02:23:33.115782+00	scratch-card:52	manual_hotspot	f	\N	scratch_card	hotspot	\N
38	cash	SCRATCH-53-1792291827499	\N	5.00	processed	CA:3E:69:AD:93:A4	Scratch-card redemption for voucher 53	t	2026-10-18 02:50:27.551085+00	2026-10-18 02:50:27.551085+00	scratch-card:53	manual_hotspot	f	\N	scratch_card	hotspot	\N
40	cash	CASH-RENEW-1792296269893	01763236150	500.00	PAID	10011	\N	t	2026-10-18 04:04:32.505357+00	\N	\N	\N	f	\N	other	pppoe	\N
41	cash	SCRATCH-54-1792297715732	\N	90.00	processed	FA:A9:D4:04:F7:82	Scratch-card redemption for voucher 54	t	2026-10-18 04:28:35.781913+00	2026-10-18 04:28:35.781913+00	scratch-card:54	manual_hotspot	f	\N	scratch_card	hotspot	\N
39	bkash	DJI967H5VX	01710415717	10.00	processed	CA:3E:69:AD:93:A4	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 560.02. TrxID DJI967H5VX at 18/10/2026 09:31	t	2026-10-18 03:31:44.10393+00	2026-10-18 04:48:11.9907+00	force_hotspot:admin	force_hotspot	f	\N	online_mfs	hotspot	\N
42	cash	CASH-RENEW-1792593909263	01332081110	500.00	PAID	1010	\N	t	2026-10-21 14:45:10.543509+00	\N	\N	\N	f	\N	other	pppoe	\N
13	bkash	DJE00G9VA4	01710415717	10.00	unmatched	\N	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 25.02. TrxID DJE00G9VA4 at 14/10/2026 21:52	f	2026-10-14 15:52:19.516175+00	\N	\N	\N	f	\N	other	hotspot	\N
43	cash	SCRATCH-59-1792647944947	01710415717	10.00	processed	CA:3E:69:AD:93:A4	Scratch-card redemption for voucher 59	t	2026-10-22 05:45:44.98493+00	2026-10-22 05:45:44.98493+00	scratch-card:59	manual_hotspot	f	\N	scratch_card	hotspot	\N
44	cash	CASH-RENEW-1792655625442	01723250330	500.00	PAID	muslim1234	\N	t	2026-10-22 07:53:48.67531+00	\N	\N	\N	f	\N	other	pppoe	\N
45	cash	CASH-RENEW-1792673798037	01774036879	500.00	PAID	10009	\N	t	2026-10-22 12:56:39.470908+00	\N	\N	\N	f	\N	other	pppoe	\N
46	cash	SCRATCH-60-1792683414868	\N	90.00	processed	F2:E1:8C:99:DD:7E	Scratch-card redemption for voucher 60	t	2026-10-22 15:36:54.906178+00	2026-10-22 15:36:54.906178+00	scratch-card:60	manual_hotspot	f	\N	scratch_card	hotspot	\N
47	bkash	DJN4ETVJLK	01710415717	10.00	unmatched	\N	You have received Tk 10.00 from 01710415717. Fee Tk 0.00. Balance Tk 590.02. TrxID DJN4ETVJLK at 23/10/2026 08:14	f	2026-10-23 02:34:21.898273+00	\N	\N	\N	f	\N	other	hotspot	\N
48	bkash	DJN8EU7AVQ	01710415717	20.00	processed	CA:3E:69:AD:93:A4	You have received Tk 20.00 from 01710415717. Fee Tk 0.00. Balance Tk 610.02. TrxID DJN8EU7AVQ at 23/10/2026 08:23	t	2026-10-23 02:34:21.913583+00	2026-10-23 09:41:10.407202+00	CA:3E:69:AD:93:A4	hotspot	f	\N	online_mfs	hotspot	\N
49	bkash	DJN4FI3J8G	01710415717	500.00	PAID	10006	You have received Tk 500.00 from 01710415717. Ref 10006. Fee Tk 0.00. Balance Tk 1,110.02. TrxID DJN4FI3J8G at 23/10/2026 17:23	t	2026-10-23 11:25:32.412647+00	2026-10-23 11:32:45.064096+00	10006	pppoe	f	\N	other	pppoe	\N
50	cash	SCRATCH-61-1792833697144	\N	1.00	processed	0C:90:43:5D:92:0F	Scratch-card redemption for voucher 61	t	2026-10-24 09:21:37.181832+00	2026-10-24 09:21:37.181832+00	scratch-card:61	manual_hotspot	f	\N	scratch_card	hotspot	\N
51	cash	SCRATCH-72-1792847330370	\N	40.00	processed	60:AB:67:D5:C8:3C	Scratch-card redemption for voucher 72	t	2026-10-24 13:08:50.407934+00	2026-10-24 13:08:50.407934+00	scratch-card:72	manual_hotspot	f	\N	scratch_card	hotspot	\N
52	cash	CASH-RENEW-1792870039732	01710415717	500.00	PAID	10006	\N	t	2026-10-24 19:27:20.756989+00	\N	\N	\N	f	\N	other	pppoe	\N
53	cash	CASH-RENEW-1792877207396	01710415717	500.00	PAID	10006	\N	t	2026-10-24 21:26:48.46169+00	\N	\N	\N	f	\N	other	pppoe	\N
55	cash	SCRATCH-75-1792923664489	01710415717	15.00	processed	CA:3E:69:AD:93:A4	Scratch-card redemption for voucher 75	t	2026-10-25 10:21:04.525441+00	2026-10-25 10:21:04.525441+00	scratch-card:75	manual_hotspot	f	\N	scratch_card	\N	\N
56	cash	SCRATCH-78-1792929321126	01710415717	15.00	processed	CA:3E:69:AD:93:A4	Scratch-card redemption for voucher 78	t	2026-10-25 11:55:21.165007+00	2026-10-25 11:55:21.165007+00	scratch-card:78	manual_hotspot	f	\N	scratch_card	\N	\N
57	cash	CASH-1792936644960-32	01770708734	500.00	PAID	1011	\N	t	2026-10-25 13:57:25.719751+00	\N	\N	\N	f	\N	other	\N	\N
58	cash	ADM-MANUAL-83	01710415717	0.00	processed	2L3A3ZJK	Admin manual counter cash sale for voucher 83	t	2026-10-25 14:13:59.913575+00	2026-10-25 14:13:59.913575+00	admin_manual:83	manual_hotspot	f	\N	manual	\N	\N
59	cash	ADM-MANUAL-84	01792954059	150.00	processed	PXNPLZAT	Admin manual counter cash sale for voucher 84	t	2026-10-25 15:12:41.425813+00	2026-10-25 15:12:41.425813+00	admin_manual:84	manual_hotspot	f	\N	manual	\N	\N
60	bkash	DJQ2KAPMP0	01710415717	20.00	processed	CA:3E:69:AD:93:A4	You have received Tk 20.00 from 01710415717. Fee Tk 0.00. Balance Tk 1,630.02. TrxID DJQ2KAPMP0 at 26/10/2026 13:07	t	2026-10-26 07:07:50.773995+00	2026-10-26 11:57:58.360419+00	CA:3E:69:AD:93:A4	hotspot	f	\N	online_mfs	\N	\N
\.


ALTER TABLE public.transactions ENABLE TRIGGER ALL;

--
-- Data for Name: hotspot_vouchers; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.hotspot_vouchers DISABLE TRIGGER ALL;

COPY public.hotspot_vouchers (id, username, password, profile, validity, price, status, comment, transaction_id, renewal_stacked, created_at, phone, customer_name, note, server, time_limit, data_limit, first_login_at, expires_at, expired_at, cleanup_status, cleanup_attempts, cleanup_error, router_removed_at, updated_at, profile_id, mac_address, pre_expiry_notified, mac_lock, subscriber_type, activation_type, batch_id, last_known_mac, mac_audit_history) FROM stdin;
57	FZNZU5A5RUY	FZNZU5A5RUY	5 M	5m	10.00	archived	FAZ|DIRECT_SUBSCRIBER|PROFILE=5 M|VALIDITY=5m	\N	f	2026-10-22 01:54:55.285907+00	01814237287	Rabbi		400 Hotspot	5m	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-22 05:43:10.954853+00	5 M	\N	f	t	direct_subscriber	first_login	\N	\N	[]
32	1A:6C:B6:27:F2:2B	1A:6C:B6:27:F2:2B	7-Day	imported	0.00	archived	Exp: 2026-10-22 21:26:00	\N	f	2026-10-17 11:44:39.651975+00	Unlinked	Imported Subscriber	\N	400 Hotspot	\N	\N	2026-10-17 11:44:39.651975+00	2026-10-22 15:26:00+00	2026-10-22 15:26:00+00	completed	1	\N	\N	2026-10-22 17:55:31.627143+00	\N	1A:6C:B6:27:F2:2B	t	t	legacy	legacy	\N	\N	[]
38	PENDING-01710415717	01710415717	5 M	5m	5.00	archived	FAZ|PENDING|PROFILE=5 M	\N	f	2026-10-17 19:02:44.107244+00	01710415717	Rabbi		400 Hotspot	5m	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 00:00:36.556635+00	5 M	\N	f	f	legacy	legacy	\N	\N	[]
37	PENDING-01518473368	01518473368	1-Hour	1h	10.00	archived	FAZ|PENDING|PROFILE=1-Hour	35	f	2026-10-17 14:53:43.180751+00	01518473368	\N	\N	all	1h	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 00:00:46.226241+00	1-Hour	\N	f	t	legacy	legacy	\N	\N	[]
33	3E:D9:76:86:99:43	3E:D9:76:86:99:43	1-Day	1 days	20.00	archived	Exp: 2026-10-19 19:47:33	\N	t	2026-10-17 11:44:39.658095+00	01710415717	Rabbi		400 Hotspot	\N	\N	2026-10-17 11:44:39.658095+00	2026-10-19 13:47:33.947+00	2026-10-17 11:56:51.703+00	completed	2	\N	2026-10-17 13:06:03.959+00	2026-10-18 00:01:02.967252+00	1-Day	3E:D9:76:86:99:43	f	t	legacy	legacy	\N	\N	[]
28	9E:D9:25:D6:C2:80	9E:D9:25:D6:C2:80	30-Day	imported	0.00	archived	Exp: 2026-10-29 21:15:33	\N	f	2026-10-17 11:44:39.633866+00	01743049190	Md. Jakir Islam		400 Hotspot	\N	\N	2026-10-17 11:44:39.633866+00	2026-10-29 15:15:33+00	2026-10-24 09:13:53.784+00	completed	1	\N	\N	2026-10-24 09:20:06.62253+00	\N	9E:D9:25:D6:C2:80	f	t	legacy	legacy	\N	\N	[]
27	EE:5B:19:B2:22:EC	EE:5B:19:B2:22:EC	30-Day	imported	0.00	archived	Exp: 2026-10-23 19:00:50	\N	f	2026-10-17 11:44:39.627016+00	01999999999	Arman islam		400 Hotspot	\N	\N	2026-10-17 11:44:39.627016+00	2026-10-23 13:00:50+00	2026-10-23 13:00:50+00	completed	1	\N	\N	2026-10-24 09:20:12.821409+00	\N	EE:5B:19:B2:22:EC	t	t	legacy	legacy	\N	\N	[]
54	FA:A9:D4:04:F7:82	FA:A9:D4:04:F7:82	7-Day	7d	90.00	archived	Exp: 2026-10-25 10:28:34	\N	f	2026-10-18 04:24:55.153924+00	\N	\N	\N	all	\N	\N	2026-10-18 04:28:34.297+00	2026-10-25 04:28:34+00	2026-10-25 04:28:34+00	completed	1	\N	\N	2026-10-25 10:15:11.297457+00	\N	FA:A9:D4:04:F7:82	t	f	scratch_voucher	first_login	df4e8915-0a4f-4c89-8840-24c611e7d293	\N	[]
53	CA:3E:69:AD:93:A4	CA:3E:69:AD:93:A4	5 M	5m	10.00	archived	Exp: 2026-10-18 10:53:12	39	f	2026-10-18 02:36:11.416803+00	01710415717	Rabbi		all	5m	\N	2026-10-18 02:50:25.976+00	2026-10-18 04:53:12.567+00	2026-10-18 04:53:12.567+00	completed	3	\N	\N	2026-10-25 10:21:02.753916+00	5 M	\N	t	f	scratch_voucher	first_login	848a643d-1dda-4a92-adc8-4edaef239306	\N	[]
48	FAZ-HY7CYJ	JSASJVYO	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:43:53.262475+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
47	FAZ-RE50GL	E9UK9E5L	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:43:58.007536+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
46	FAZ-FIGANG	U1ABN85W	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:44:02.716884+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
45	FAZ-FV8DC3	NKGHXHZY	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:44:05.759307+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
44	FAZ-AG2NPA	TB8USKCR	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:44:09.473574+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
43	FAZ-UBF0Q3	AKMTE2GM	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:44:13.012737+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
41	FAZ-BVGYDJ	MIYRSQHF	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:44:16.556393+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
42	FAZ-EHQC6U	0PFUVMWT	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:44:19.698193+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
40	FAZ-LVQO5K	1H8IWCGT	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:44:23.422971+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
39	FAZ-7BWZCF	S2P7CEU4	5 M	5m	20.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:39:04.98678+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 01:45:04.037168+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
49	B0JVBX	6K8TJORS	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 01:45:29.732495+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 02:04:40.802928+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
50	EGXE	CLZBQLNT	5 M	5m	5.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 02:04:59.520819+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 02:07:18.680642+00	\N	\N	f	f	scratch_voucher	first_login	\N	\N	[]
51	0DMJ	7INDTPKL	5 M	5m	1.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-18 02:08:45.939736+00	01710415717	Rabbi		all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-18 02:10:30.485564+00	\N	\N	f	t	scratch_voucher	first_login	\N	\N	[]
36	CA:3E:69:AD:93:A4	CA:3E:69:AD:93:A4	30-Day	30 days	150.00	archived	Exp: 2026-12-16 20:42:29	\N	t	2026-10-17 13:42:03.125971+00	01710415717	Rabbi		400 Hotspot	1h	\N	2026-10-17 13:42:29.626+00	2026-12-16 14:42:29.626+00	2026-10-17 14:43:05.636+00	completed	1	\N	2026-10-17 14:43:10.745+00	2026-10-18 02:23:26.28044+00	30-Day	\N	f	t	legacy	legacy	\N	\N	[]
52	CA:3E:69:AD:93:A4	CA:3E:69:AD:93:A4	expired_profile	5m	5.00	archived	Exp: 2026-10-18 08:28:30	\N	f	2026-10-18 02:22:44.704859+00	\N	\N	\N	all	\N	\N	2026-10-18 02:23:30.003+00	2026-10-18 02:28:30.003+00	2026-10-18 02:28:30.003+00	completed	1	\N	\N	2026-10-18 02:50:24.213063+00	\N	\N	t	f	scratch_voucher	first_login	\N	\N	[]
18	A6:FD:56:03:24:49	A6:FD:56:03:24:49	1-Day	1d	20.00	archived	Exp: 2026-10-18 20:57:50	\N	f	2026-10-16 17:36:54.554124+00	01785219468	\N	\N	400 Hotspot	1d	\N	2026-10-17 14:57:50.594+00	2026-10-18 14:57:50.594+00	2026-10-18 14:57:50.594+00	completed	75	\N	\N	2026-10-18 18:25:16.785705+00	1-Day	A6:FD:56:03:24:49	t	t	legacy	legacy	\N	\N	[]
55	STAGED-14b5bebd-060d-4d07-856b-0832531b0b4b	GYicTJdRSDZHqWBsI6w7hwnp6dIF02-p	5 M	5m	10.00	archived	FAZ|PENDING|DIRECT_SUBSCRIBER|PROFILE=5 M	\N	f	2026-10-19 19:00:25.974845+00	01710415717	Rabbi		400 Hotspot	5m	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-19 19:01:52.885862+00	5 M	\N	f	t	direct_subscriber	first_login	\N	\N	[]
29	EA:94:04:CD:40:2D	EA:94:04:CD:40:2D	30-Day	imported	0.00	active	Exp: 2026-10-30 19:58:17	\N	f	2026-10-17 11:44:39.638632+00	Unlinked	Imported Subscriber	\N	400 Hotspot	\N	\N	2026-10-17 11:44:39.638632+00	2026-10-30 13:58:17+00	\N	not_required	0	\N	\N	2026-10-20 13:23:21.334936+00	\N	EA:94:04:CD:40:2D	f	t	legacy	legacy	\N	\N	[]
31	02:4D:5C:A3:34:2E	02:4D:5C:A3:34:2E	15-Day	imported	0.00	active	Exp: 2026-10-29 05:00:00	\N	f	2026-10-17 11:44:39.648842+00	01346542409	Rasel Islam		400 Hotspot	\N	\N	2026-10-17 11:44:39.648842+00	2026-10-28 23:00:00+00	\N	not_required	0	\N	\N	2026-10-20 13:23:22.056446+00	\N	02:4D:5C:A3:34:2E	f	t	legacy	legacy	\N	\N	[]
24	3C:57:6C:99:37:37	01324099529	30-Day	30d	150.00	active	Exp: 2026-11-16 15:40:06	\N	f	2026-10-17 09:38:42.31048+00	01324099529	Md Ojifur Islam		400 Hotspot	30d	\N	2026-10-17 09:40:06.517+00	2026-11-14 09:40:06+00	\N	not_required	0	\N	\N	2026-10-20 13:23:22.776303+00	30-Day	3C:57:6C:99:37:37	f	t	legacy	legacy	\N	\N	[]
56	01710415717	01710415717	5 M	5m	10.00	archived	FAZ|DIRECT_SUBSCRIBER|PROFILE=5 M|VALIDITY=5m	\N	f	2026-10-22 00:26:44.264461+00	01710415717	Rabbi		all	5m	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-22 02:25:17.452215+00	5 M	\N	f	t	direct_subscriber	first_login	\N	\N	[]
58	FAZ-PSL9SY	7QVHABDN	5 M	5m	0.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-22 02:28:15.446934+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-22 05:43:22.563203+00	\N	\N	f	f	scratch_voucher	first_login	a50ee31b-da02-4cd9-8a2c-85a4cee7c977	\N	[]
82	CA:3E:69:AD:93:A4	CA:3E:69:AD:93:A4	5M	5m	0.00	deleted	Exp: 2026-10-25 19:51:41	\N	f	2026-10-25 13:45:05.717835+00	01710415717	Rabbi	\N	400 Hotspot	5m	\N	2026-10-25 13:46:41.03+00	2026-10-25 13:51:41.03+00	2026-10-25 13:51:41.03+00	completed	2	\N	2026-10-25 14:13:42.320867+00	2026-10-25 14:13:42.320867+00	5M	\N	f	f	admin_voucher	first_login	31c732b8-9ac6-4bb3-b575-5dde84457030	CA:3E:69:AD:93:A4	["CA:3E:69:AD:93:A4"]
60	F2:E1:8C:99:DD:7E	F2:E1:8C:99:DD:7E	15-Day	15d	90.00	active	Exp: 2026-11-06 21:36:54	\N	f	2026-10-22 15:33:34.552642+00	Unlinked	Arshad	\N	all	\N	\N	2026-10-22 15:36:54.283+00	2026-11-06 15:36:54.283+00	\N	not_required	0	\N	\N	2026-10-22 15:36:54.827857+00	\N	F2:E1:8C:99:DD:7E	f	f	scratch_voucher	first_login	ad51078b-20b1-4017-920c-830c7bddaad3	\N	[]
84	PXNPLZAT	04J637WZ	30-Day	30d	150.00	unused	FAZ NETWORK manual voucher; package validity applies on first successful login.	59	f	2026-10-25 15:12:41.425813+00	01792954059	Edris Ali	\N	400 Hotspot	30d	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-25 15:12:41.425813+00	30-Day	\N	f	f	admin_voucher	first_login	6486f6d8-41fb-42af-ba80-ef4b35069a8f	\N	[]
30	BA:BB:C4:32:60:BE	BA:BB:C4:32:60:BE	30-Day	imported	0.00	deleted	Exp: 2026-10-25 21:15:33	\N	f	2026-10-17 11:44:39.642164+00	Unlinked	Imported Subscriber	\N	400 Hotspot	\N	\N	2026-10-17 11:44:39.642164+00	2026-10-25 15:15:33+00	2026-10-25 15:15:33+00	completed	2	\N	2026-10-25 19:46:04.621432+00	2026-10-25 19:46:04.621432+00	\N	\N	t	t	legacy	legacy	\N	BA:BB:C4:32:60:BE	["BA:BB:C4:32:60:BE"]
61	0C:90:43:5D:92:0F	0C:90:43:5D:92:0F	7-Day	7d	1.00	active	Exp: 2026-10-31 15:21:36	\N	f	2026-10-24 09:20:55.852591+00	01743049190	Jakir Islam		all	\N	\N	2026-10-24 09:21:36.559+00	2026-10-31 09:21:36.559+00	\N	not_required	0	\N	\N	2026-10-24 09:24:51.414298+00	\N	0C:90:43:5D:92:0F	f	t	scratch_voucher	first_login	52630b13-b6f3-482c-9073-23023d7d486d	\N	[]
62	FAZ-IR84AI	TJM51Q3P	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-24 13:08:30.978907+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
63	FAZ-HCW55S	WX1ZBBNW	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-24 13:35:43.236898+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
64	FAZ-FLZJTT	EH9XGJLY	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-24 13:35:52.857266+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
66	FAZ-QM7TUC	99Y9YKY7	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-25 01:04:11.157703+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
65	FAZ-U1JJTK	B1EYH9C4	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-25 01:04:17.778877+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
59	CA:3E:69:AD:93:A4	CA:3E:69:AD:93:A4	1-Day	1d	20.00	archived	Exp: 2026-10-24 15:41:10	48	f	2026-10-22 05:44:29.740763+00	01710415717	Rabbi		400 Hotspot	1d	\N	2026-10-23 09:41:10.678+00	2026-10-24 09:41:10.677+00	\N	not_required	1	\N	\N	2026-10-25 10:21:02.753916+00	1-Day	\N	f	t	direct_subscriber	first_login	\N	\N	[]
75	841883	841883	12-Hour	12h	15.00	archived	Exp: 2026-10-26 04:21:03	\N	f	2026-10-25 10:20:22.984701+00	01710415717	\N	\N	all	12h	\N	2026-10-25 10:21:03.952+00	2026-10-25 22:21:03.952+00	\N	not_required	0	\N	\N	2026-10-25 11:55:19.40369+00	12-Hour	\N	f	f	scratch_voucher	first_login	\N	\N	[]
78	CA:3E:69:AD:93:A4	CA:3E:69:AD:93:A4	12-Hour	12h	15.00	archived	Exp: 2026-10-26 05:55:20	\N	f	2026-10-25 11:53:23.285964+00	01710415717	Faz Network	\N	400 Hotspot	12h	\N	2026-10-25 11:55:20.516+00	2026-10-25 23:55:20.516+00	\N	not_required	0	\N	\N	2026-10-25 12:53:57.258024+00	12-Hour	\N	f	f	scratch_voucher	first_login	e14c0b91-a0ff-4d21-93e6-09036ff76dfe	\N	[]
72	60:AB:67:D5:C8:3C	60:AB:67:D5:C8:3C	3-Day	3d	40.00	active	Exp: 2026-10-27 19:08:49	\N	f	2026-10-24 13:07:12.536087+00	Unlinked	\N	\N	all	\N	\N	2026-10-24 13:08:49.777+00	2026-10-27 13:08:49.777+00	\N	not_required	0	\N	\N	2026-10-24 13:08:50.327167+00	\N	60:AB:67:D5:C8:3C	f	f	scratch_voucher	first_login	b59fa72a-141f-4feb-90de-960cfa1afe60	\N	[]
71	FAZ-X15AMQ	QJSBZZ7D	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-24 13:35:27.669483+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
70	FAZ-KOQYU3	3AJTBH9L	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-24 13:35:35.595485+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
69	FAZ-DTKBDY	MCGB7XLU	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-24 14:00:23.301986+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
68	FAZ-GJPVRQ	9RT0SUYT	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-24 14:11:18.31421+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
67	FAZ-5GHRC5	AMGBWTDL	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-24 10:29:25.28195+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-25 01:04:03.303602+00	\N	\N	f	f	scratch_voucher	first_login	be617fca-3345-4628-a030-3ad2f59be344	\N	[]
81	CA:3E:69:AD:93:A4	CA:3E:69:AD:93:A4	12-Hour	12h	15.00	deleted	Exp: 2026-10-26 06:53:58	\N	f	2026-10-25 12:52:41.061648+00	01710415717	\N	\N	400 Hotspot	12h	\N	2026-10-25 12:53:58.618+00	2026-10-26 00:53:58.618+00	\N	completed	1	\N	2026-10-25 13:43:11.490446+00	2026-10-25 13:43:11.490446+00	12-Hour	\N	f	f	admin_voucher	first_login	f053bfed-ef92-49c8-80f0-5eb734f5a410	CA:3E:69:AD:93:A4	["CA:3E:69:AD:93:A4"]
73	HN-6C982EA2A981	736387	12-Hour	12h	15.00	archived	FAZ|PENDING|DIRECT_SUBSCRIBER|PROFILE=12-Hour	\N	f	2026-10-25 04:14:57.749282+00	01710415717			400 Hotspot	12h	\N	2026-10-25 04:18:08.998+00	2026-10-25 16:18:08.998+00	\N	not_required	0	\N	\N	2026-10-25 10:21:02.753916+00	12-Hour	\N	f	t	direct_subscriber	first_login	\N	\N	[]
74	44138337	44138337	12-Hour	12h	15.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-25 09:04:35.913805+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-25 11:07:40.628197+00	\N	\N	f	f	scratch_voucher	first_login	93f5b857-a2cb-48d1-afa2-39901fd42e32	\N	[]
85	1L0R	N7RQ9IJR	1-Day	1d	20.00	unused	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-26 07:03:16.065483+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-26 07:03:16.065483+00	\N	\N	f	f	scratch_voucher	first_login	a2245138-7c2a-4963-a495-a500649ecbed	\N	[]
77	UGQZJMUF	1DJBDITA	12-Hour	12h	15.00	archived	FAZ NETWORK manual voucher; package validity applies on first successful login.	\N	f	2026-10-25 11:51:43.569928+00	\N	\N	\N	400 Hotspot	12h	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-25 11:53:02.294656+00	12-Hour	\N	f	f	scratch_voucher	first_login	0601aa1f-bf91-48d2-907d-aa09d7459404	\N	[]
76	FAZ-JWTVKV	FXBRR5TV	30-Day	30d	150.00	archived	Scratch voucher; profile validity applies on first successful login.	\N	f	2026-10-25 11:08:48.969927+00	\N	\N	\N	all	\N	\N	\N	\N	\N	not_required	0	\N	\N	2026-10-25 11:53:07.942892+00	\N	\N	f	f	scratch_voucher	first_login	8c10918a-5f30-439b-adc7-c5771436a7b6	\N	[]
83	CA:3E:69:AD:93:A4	CA:3E:69:AD:93:A4	1-Day	1d	20.00	active	Exp: 2026-10-27 17:57:58	60	f	2026-10-25 14:13:59.913575+00	01710415717	Faz Network	\N	400 Hotspot	1d	\N	2026-10-26 11:57:58.639+00	2026-10-27 11:57:58.638+00	\N	not_required	1	\N	\N	2026-10-26 11:58:00.395736+00	1-Day	CA:3E:69:AD:93:A4	f	f	admin_voucher	first_login	d4a02114-3e1e-484b-bab4-85a879755ac7	CA:3E:69:AD:93:A4	["CA:3E:69:AD:93:A4"]
\.


ALTER TABLE public.hotspot_vouchers ENABLE TRIGGER ALL;

--
-- Data for Name: hotspot_voucher_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.hotspot_voucher_payments DISABLE TRIGGER ALL;

COPY public.hotspot_voucher_payments (transaction_id, voucher_id, phone, amount, created_at, profile, sale_type) FROM stdin;
43	59	01710415717	10.00	2026-10-22 05:45:45.066431+00	5 M	scratch_card
48	59	Unlinked	20.00	2026-10-23 09:41:10.489417+00	1-Day	online_mfs
35	37	01518473368	10.00	2026-10-17 14:53:43.180751+00	1-Hour	online_mfs
55	75	01710415717	15.00	2026-10-25 10:21:04.635372+00	12-Hour	scratch_card
46	60	Unlinked	90.00	2026-10-22 15:36:54.988721+00	15-Day	scratch_card
51	72	Unlinked	40.00	2026-10-24 13:08:50.490722+00	3-Day	scratch_card
37	52	Unlinked	5.00	2026-10-18 02:23:33.23317+00	5 M	scratch_card
41	54	Unlinked	90.00	2026-10-18 04:28:35.889109+00	7-Day	scratch_card
58	83	01710415717	0.00	2026-10-25 14:13:59.913575+00	5M	manual
59	84	01792954059	150.00	2026-10-25 15:12:41.425813+00	30-Day	manual
38	53	Unlinked	5.00	2026-10-18 02:50:27.663419+00	5 M	scratch_card
14	\N	01518473368	10.00	2026-10-14 18:07:00.149971+00	\N	online_mfs
15	\N	01710415717	15.00	2026-10-14 18:12:46.787345+00	\N	online_mfs
16	\N	01518473368	10.00	2026-10-14 18:28:15.1246+00	\N	online_mfs
17	\N	01518473368	15.00	2026-10-14 18:33:51.281785+00	\N	online_mfs
30	\N	01710415717	10.00	2026-10-16 17:45:57.81597+00	\N	online_mfs
31	\N	01710415717	10.00	2026-10-16 18:35:47.47701+00	\N	online_mfs
56	78	01710415717	15.00	2026-10-25 11:55:21.255336+00	12-Hour	scratch_card
32	\N	01518473368	10.00	2026-10-16 19:49:19.630177+00	\N	online_mfs
33	\N	01814237287	20.00	2026-10-16 19:56:07.723036+00	\N	online_mfs
39	53		10.00	2026-10-18 04:48:12.096009+00	5 M	online_mfs
60	83	Unlinked	20.00	2026-10-26 11:57:58.443477+00	1-Day	online_mfs
50	61	Unlinked	1.00	2026-10-24 09:21:37.260895+00	7-Day	scratch_card
\.


ALTER TABLE public.hotspot_voucher_payments ENABLE TRIGGER ALL;

--
-- Data for Name: hotspot_voucher_sales_archive; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.hotspot_voucher_sales_archive DISABLE TRIGGER ALL;

COPY public.hotspot_voucher_sales_archive (transaction_id, channel, trx_id, sender_phone, amount, status, matched_username, created_at, voucher_count, sale_type, subscriber_type) FROM stdin;
\.


ALTER TABLE public.hotspot_voucher_sales_archive ENABLE TRIGGER ALL;

--
-- Data for Name: hr_departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.hr_departments DISABLE TRIGGER ALL;

COPY public.hr_departments (id, name, description, status, created_by, created_at, updated_at) FROM stdin;
\.


ALTER TABLE public.hr_departments ENABLE TRIGGER ALL;

--
-- Data for Name: hr_employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.hr_employees DISABLE TRIGGER ALL;

COPY public.hr_employees (id, employee_code, full_name, phone, email, department_id, designation, joining_date, status, notes, created_by, created_at, updated_at) FROM stdin;
\.


ALTER TABLE public.hr_employees ENABLE TRIGGER ALL;

--
-- Data for Name: ip_pools; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.ip_pools DISABLE TRIGGER ALL;

COPY public.ip_pools (id, name, ranges, subnet, local_address, device_name, next_pool, created_at, updated_at) FROM stdin;
1	Expire_Pool	100.65.96.2-100.65.111.254	100.65.96.1/20	100.65.96.1	Tp-link	none	2026-10-08 09:06:01.197426+00	2026-10-08 09:06:43.461801+00
2	100 mbps	10.81.0.2-10.81.0.254	10.81.0.1/24	10.81.0.1	Tp-link	none	2026-10-08 09:06:01.199648+00	2026-10-08 09:06:43.464369+00
3	150 Mbps	10.82.0.2-10.82.0.254	10.82.0.1/24	10.82.0.1	Tp-link	none	2026-10-08 09:06:01.201232+00	2026-10-08 09:06:43.465728+00
4	400_Hotspot	10.71.0.2-10.71.0.254	10.71.0.1/24	10.71.0.1	Tp-link	none	2026-10-08 09:06:01.202678+00	2026-10-08 09:06:43.467154+00
5	Userman Hotspot	10.15.20.2-10.15.20.254	10.15.20.1/24	10.15.20.1	Tp-link	none	2026-10-08 09:06:01.204204+00	2026-10-08 09:06:43.468557+00
32	PPPoE_Pool	10.20.0.2-10.20.0.254	10.20.0.0/24	10.20.0.1	Tp-link	none	2026-10-08 13:46:02.030793+00	2026-10-13 22:06:09.413971+00
33	Starlink PPPoE_Pool	30.40.0.2-30.40.0.254	30.40.0.1/24	30.40.0.1	Tp-link	none	2026-10-10 21:31:25.051909+00	2026-10-13 16:28:04.10356+00
\.


ALTER TABLE public.ip_pools ENABLE TRIGGER ALL;

--
-- Data for Name: network_discovery_sources; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.network_discovery_sources DISABLE TRIGGER ALL;

COPY public.network_discovery_sources (id, device_id, source_key, protocol, enabled, settings, last_attempt_at, last_success_at, last_status, last_error, created_at, updated_at) FROM stdin;
\.


ALTER TABLE public.network_discovery_sources ENABLE TRIGGER ALL;

--
-- Data for Name: network_discovery_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.network_discovery_runs DISABLE TRIGGER ALL;

COPY public.network_discovery_runs (id, source_id, device_id, run_type, status, started_at, finished_at, discovered_count, matched_count, unmatched_count, details, error_message) FROM stdin;
1	\N	\N	scheduled	succeeded	2026-10-12 10:35:49.755791+00	2026-10-12 10:35:56.86345+00	60	19	41	{"router": {"model": "RB4011iGS+", "uptime": "1d10h33m35s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
2	\N	\N	scheduled	succeeded	2026-10-12 10:45:49.350694+00	2026-10-12 10:45:54.044957+00	58	19	39	{"router": {"model": "RB4011iGS+", "uptime": "1d10h43m32s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
3	\N	\N	scheduled	succeeded	2026-10-12 10:55:49.356492+00	2026-10-12 10:55:54.423967+00	60	19	41	{"router": {"model": "RB4011iGS+", "uptime": "1d10h53m32s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
4	\N	\N	scheduled	succeeded	2026-10-12 10:59:58.712854+00	2026-10-12 11:00:03.240696+00	19	19	0	{"router": {"model": "RB4011iGS+", "uptime": "1d10h57m41s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
5	\N	\N	scheduled	succeeded	2026-10-12 11:09:58.441122+00	2026-10-12 11:10:02.955004+00	57	19	38	{"router": {"model": "RB4011iGS+", "uptime": "1d11h7m41s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
6	\N	\N	scheduled	succeeded	2026-10-12 11:19:58.446307+00	2026-10-12 11:20:02.960063+00	56	19	37	{"router": {"model": "RB4011iGS+", "uptime": "1d11h17m41s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
7	\N	\N	scheduled	succeeded	2026-10-12 11:29:58.450437+00	2026-10-12 11:30:02.940785+00	57	19	38	{"router": {"model": "RB4011iGS+", "uptime": "1d11h27m41s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
8	\N	\N	scheduled	succeeded	2026-10-12 11:31:40.030642+00	2026-10-12 11:31:45.436578+00	21	19	2	{"router": {"model": "RB4011iGS+", "uptime": "1d11h29m23s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
9	\N	\N	scheduled	succeeded	2026-10-12 11:41:40.003972+00	2026-10-12 11:41:44.452964+00	63	19	44	{"router": {"model": "RB4011iGS+", "uptime": "1d11h39m22s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
10	\N	\N	scheduled	succeeded	2026-10-12 11:51:40.004672+00	2026-10-12 11:51:44.445304+00	60	19	41	{"router": {"model": "RB4011iGS+", "uptime": "1d11h49m22s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
11	\N	\N	scheduled	succeeded	2026-10-12 12:01:40.008444+00	2026-10-12 12:01:44.455596+00	62	19	43	{"router": {"model": "RB4011iGS+", "uptime": "1d11h59m22s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
12	\N	\N	scheduled	succeeded	2026-10-12 12:03:50.232824+00	2026-10-12 12:03:56.944365+00	20	19	1	{"router": {"model": "RB4011iGS+", "uptime": "1d12h1m35s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
13	\N	\N	scheduled	succeeded	2026-10-12 12:13:49.959579+00	2026-10-12 12:13:54.566183+00	59	19	40	{"router": {"model": "RB4011iGS+", "uptime": "1d12h11m33s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
14	\N	\N	scheduled	succeeded	2026-10-12 12:23:49.969268+00	2026-10-12 12:23:54.663342+00	63	19	44	{"router": {"model": "RB4011iGS+", "uptime": "1d12h21m33s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
15	\N	\N	scheduled	succeeded	2026-10-12 12:33:49.975958+00	2026-10-12 12:33:55.258537+00	63	19	44	{"router": {"model": "RB4011iGS+", "uptime": "1d12h31m33s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
16	\N	\N	scheduled	succeeded	2026-10-12 12:43:49.990494+00	2026-10-12 12:43:54.861189+00	61	19	42	{"router": {"model": "RB4011iGS+", "uptime": "1d12h41m33s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
17	\N	\N	scheduled	succeeded	2026-10-12 12:47:57.332099+00	2026-10-12 12:48:00.973287+00	26	19	7	{"router": {"model": "RB4011iGS+", "uptime": "1d12h45m39s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "10m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
18	\N	\N	scheduled	succeeded	2026-10-12 12:52:57.142018+00	2026-10-12 12:53:02.734489+00	59	18	41	{"router": {"model": "RB4011iGS+", "uptime": "1d12h50m40s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
19	\N	\N	scheduled	succeeded	2026-10-12 12:57:57.14548+00	2026-10-12 12:58:02.037424+00	24	18	6	{"router": {"model": "RB4011iGS+", "uptime": "1d12h55m40s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
20	\N	\N	scheduled	succeeded	2026-10-12 13:02:57.144845+00	2026-10-12 13:03:02.841308+00	58	18	40	{"router": {"model": "RB4011iGS+", "uptime": "1d13h40s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
21	\N	\N	scheduled	succeeded	2026-10-12 13:07:57.146377+00	2026-10-12 13:08:02.834449+00	23	18	5	{"router": {"model": "RB4011iGS+", "uptime": "1d13h5m40s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
22	\N	\N	scheduled	succeeded	2026-10-12 13:12:57.149468+00	2026-10-12 13:13:02.86098+00	54	18	36	{"router": {"model": "RB4011iGS+", "uptime": "1d13h10m40s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
23	\N	\N	scheduled	succeeded	2026-10-12 13:15:51.694066+00	2026-10-12 13:15:59.057894+00	19	18	1	{"router": {"model": "RB4011iGS+", "uptime": "1d13h13m37s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
24	\N	\N	scheduled	succeeded	2026-10-12 13:20:51.345279+00	2026-10-12 13:20:55.965775+00	29	19	10	{"router": {"model": "RB4011iGS+", "uptime": "1d13h18m34s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
25	\N	\N	scheduled	succeeded	2026-10-12 13:22:52.640713+00	2026-10-12 13:22:57.665184+00	52	19	33	{"router": {"model": "RB4011iGS+", "uptime": "1d13h20m36s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
26	\N	\N	scheduled	succeeded	2026-10-12 13:27:52.348283+00	2026-10-12 13:27:56.84346+00	23	19	4	{"router": {"model": "RB4011iGS+", "uptime": "1d13h25m35s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
27	\N	\N	scheduled	succeeded	2026-10-12 13:32:52.353966+00	2026-10-12 13:32:57.245436+00	58	19	39	{"router": {"model": "RB4011iGS+", "uptime": "1d13h30m35s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
28	\N	\N	scheduled	succeeded	2026-10-12 13:37:52.35417+00	2026-10-12 13:37:57.840808+00	25	19	6	{"router": {"model": "RB4011iGS+", "uptime": "1d13h35m36s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
29	\N	\N	scheduled	succeeded	2026-10-12 13:40:23.538188+00	2026-10-12 13:40:31.142429+00	19	19	0	{"router": {"model": "RB4011iGS+", "uptime": "1d13h38m9s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
30	\N	\N	scheduled	succeeded	2026-10-12 13:45:23.057831+00	2026-10-12 13:45:27.957164+00	57	19	38	{"router": {"model": "RB4011iGS+", "uptime": "1d13h43m6s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
31	\N	\N	scheduled	succeeded	2026-10-12 13:46:40.825412+00	2026-10-12 13:46:46.435144+00	19	19	0	{"router": {"model": "RB4011iGS+", "uptime": "1d13h44m25s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
32	\N	\N	scheduled	succeeded	2026-10-12 13:47:51.137591+00	2026-10-12 13:47:57.040886+00	22	19	3	{"router": {"model": "RB4011iGS+", "uptime": "1d13h45m35s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
33	\N	\N	scheduled	succeeded	2026-10-12 13:51:44.434092+00	2026-10-12 13:51:51.034684+00	20	19	1	{"router": {"model": "RB4011iGS+", "uptime": "1d13h49m29s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
34	\N	\N	scheduled	succeeded	2026-10-12 13:55:12.932458+00	2026-10-12 13:55:19.953789+00	55	19	36	{"router": {"model": "RB4011iGS+", "uptime": "1d13h52m58s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
35	\N	\N	scheduled	succeeded	2026-10-12 13:57:05.034148+00	2026-10-12 13:57:11.634597+00	22	19	3	{"router": {"model": "RB4011iGS+", "uptime": "1d13h54m50s", "version": "7.24.4 (stable)", "boardName": "RB4011iGS+", "routerName": "Tp-link"}, "cadence": "5m", "collector": "mikrotik-read-only", "bridgeHostsError": null, "bridgeHostsAvailable": true}	\N
\.


ALTER TABLE public.network_discovery_runs ENABLE TRIGGER ALL;

--
-- Data for Name: network_observations; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.network_observations DISABLE TRIGGER ALL;

COPY public.network_observations (id, discovery_run_id, source_device_id, customer_id, observation_type, identity_type, identity_value, observed_value, match_status, match_confidence, evidence, observed_at, created_at) FROM stdin;
1	1	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d10h31m51s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.532517+00	2026-10-12 10:35:56.532517+00
2	1	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d1h1m45s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.536075+00	2026-10-12 10:35:56.536075+00
4	1	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d1h1m9s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.542687+00	2026-10-12 10:35:56.542687+00
5	1	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "13h27m25s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.545158+00	2026-10-12 10:35:56.545158+00
8	1	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "11h34m46s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.55416+00	2026-10-12 10:35:56.55416+00
9	1	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "11h34m25s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.556668+00	2026-10-12 10:35:56.556668+00
10	1	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "11h34m24s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.559011+00	2026-10-12 10:35:56.559011+00
11	1	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "11h34m24s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.561426+00	2026-10-12 10:35:56.561426+00
12	1	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "11h34m19s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.563505+00	2026-10-12 10:35:56.563505+00
13	1	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "11h34m16s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.565864+00	2026-10-12 10:35:56.565864+00
14	1	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "9h32m17s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.634641+00	2026-10-12 10:35:56.634641+00
15	1	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "9h13m38s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.637869+00	2026-10-12 10:35:56.637869+00
16	1	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "8h25m23s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.640673+00	2026-10-12 10:35:56.640673+00
17	1	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "7h29m14s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.644881+00	2026-10-12 10:35:56.644881+00
18	1	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "6h18m9s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.648075+00	2026-10-12 10:35:56.648075+00
19	1	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "1h19m26s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.650871+00	2026-10-12 10:35:56.650871+00
20	1	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.654222+00	2026-10-12 10:35:56.654222+00
21	1	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.65695+00	2026-10-12 10:35:56.65695+00
22	1	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.660351+00	2026-10-12 10:35:56.660351+00
23	1	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.662746+00	2026-10-12 10:35:56.662746+00
24	1	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.666092+00	2026-10-12 10:35:56.666092+00
7	1	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "11h34m50s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.550746+00	2026-10-12 10:35:56.550746+00
6	1	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "11h34m53s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.547877+00	2026-10-12 10:35:56.547877+00
25	1	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.668965+00	2026-10-12 10:35:56.668965+00
26	1	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.671833+00	2026-10-12 10:35:56.671833+00
27	1	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.675334+00	2026-10-12 10:35:56.675334+00
28	1	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.678445+00	2026-10-12 10:35:56.678445+00
29	1	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.731792+00	2026-10-12 10:35:56.731792+00
30	1	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.735272+00	2026-10-12 10:35:56.735272+00
31	1	\N	\N	bridge_host	mac_address	3A:09:AC:B2:06:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.737963+00	2026-10-12 10:35:56.737963+00
32	1	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.740434+00	2026-10-12 10:35:56.740434+00
33	1	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.742892+00	2026-10-12 10:35:56.742892+00
34	1	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.745385+00	2026-10-12 10:35:56.745385+00
35	1	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.747625+00	2026-10-12 10:35:56.747625+00
36	1	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.751673+00	2026-10-12 10:35:56.751673+00
37	1	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.754562+00	2026-10-12 10:35:56.754562+00
38	1	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.75696+00	2026-10-12 10:35:56.75696+00
39	1	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.7594+00	2026-10-12 10:35:56.7594+00
40	1	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.761652+00	2026-10-12 10:35:56.761652+00
41	1	\N	\N	bridge_host	mac_address	52:87:79:65:DE:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.76408+00	2026-10-12 10:35:56.76408+00
42	1	\N	\N	bridge_host	mac_address	56:62:ED:8C:75:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.766408+00	2026-10-12 10:35:56.766408+00
43	1	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.768726+00	2026-10-12 10:35:56.768726+00
44	1	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.770887+00	2026-10-12 10:35:56.770887+00
45	1	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.77348+00	2026-10-12 10:35:56.77348+00
46	1	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.832376+00	2026-10-12 10:35:56.832376+00
47	1	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.834686+00	2026-10-12 10:35:56.834686+00
48	1	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.836893+00	2026-10-12 10:35:56.836893+00
49	1	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.839003+00	2026-10-12 10:35:56.839003+00
50	1	\N	\N	bridge_host	mac_address	A0:7F:09:03:B8:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.841112+00	2026-10-12 10:35:56.841112+00
51	1	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.843265+00	2026-10-12 10:35:56.843265+00
52	1	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.84519+00	2026-10-12 10:35:56.84519+00
53	1	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.8471+00	2026-10-12 10:35:56.8471+00
54	1	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.849153+00	2026-10-12 10:35:56.849153+00
55	1	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.851323+00	2026-10-12 10:35:56.851323+00
56	1	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.853429+00	2026-10-12 10:35:56.853429+00
57	1	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.855606+00	2026-10-12 10:35:56.855606+00
58	1	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.857773+00	2026-10-12 10:35:56.857773+00
59	1	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.859967+00	2026-10-12 10:35:56.859967+00
60	1	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:35:56.861999+00	2026-10-12 10:35:56.861999+00
61	2	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d10h41m48s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.758056+00	2026-10-12 10:45:53.758056+00
62	2	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d1h11m42s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.760585+00	2026-10-12 10:45:53.760585+00
64	2	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d1h11m6s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.764298+00	2026-10-12 10:45:53.764298+00
65	2	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "13h37m22s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.766326+00	2026-10-12 10:45:53.766326+00
68	2	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "11h44m43s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.772373+00	2026-10-12 10:45:53.772373+00
69	2	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "11h44m22s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.774335+00	2026-10-12 10:45:53.774335+00
70	2	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "11h44m21s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.776279+00	2026-10-12 10:45:53.776279+00
71	2	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "11h44m21s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.7781+00	2026-10-12 10:45:53.7781+00
72	2	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "11h44m16s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.780142+00	2026-10-12 10:45:53.780142+00
73	2	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "11h44m13s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.782132+00	2026-10-12 10:45:53.782132+00
74	2	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "9h42m14s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.784166+00	2026-10-12 10:45:53.784166+00
75	2	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "9h23m35s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.786194+00	2026-10-12 10:45:53.786194+00
76	2	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "8h35m20s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.788037+00	2026-10-12 10:45:53.788037+00
77	2	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "7h39m11s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.790423+00	2026-10-12 10:45:53.790423+00
67	2	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "11h44m47s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.770434+00	2026-10-12 10:45:53.770434+00
78	2	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "6h28m6s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.792479+00	2026-10-12 10:45:53.792479+00
79	2	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "1h29m23s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.794382+00	2026-10-12 10:45:53.794382+00
80	2	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.832761+00	2026-10-12 10:45:53.832761+00
81	2	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.83496+00	2026-10-12 10:45:53.83496+00
82	2	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.836969+00	2026-10-12 10:45:53.836969+00
83	2	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.838999+00	2026-10-12 10:45:53.838999+00
84	2	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.84099+00	2026-10-12 10:45:53.84099+00
85	2	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.84289+00	2026-10-12 10:45:53.84289+00
86	2	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.844819+00	2026-10-12 10:45:53.844819+00
87	2	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.846862+00	2026-10-12 10:45:53.846862+00
88	2	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.84925+00	2026-10-12 10:45:53.84925+00
89	2	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.851357+00	2026-10-12 10:45:53.851357+00
90	2	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.853431+00	2026-10-12 10:45:53.853431+00
91	2	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.855363+00	2026-10-12 10:45:53.855363+00
92	2	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.857251+00	2026-10-12 10:45:53.857251+00
93	2	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.868807+00	2026-10-12 10:45:53.868807+00
94	2	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.870812+00	2026-10-12 10:45:53.870812+00
95	2	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.872913+00	2026-10-12 10:45:53.872913+00
96	2	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.9306+00	2026-10-12 10:45:53.9306+00
97	2	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.932849+00	2026-10-12 10:45:53.932849+00
98	2	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.934857+00	2026-10-12 10:45:53.934857+00
99	2	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.936782+00	2026-10-12 10:45:53.936782+00
100	2	\N	\N	bridge_host	mac_address	52:87:79:65:DE:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.938621+00	2026-10-12 10:45:53.938621+00
101	2	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.940661+00	2026-10-12 10:45:53.940661+00
102	2	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.942798+00	2026-10-12 10:45:53.942798+00
103	2	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.94485+00	2026-10-12 10:45:53.94485+00
104	2	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.946861+00	2026-10-12 10:45:53.946861+00
105	2	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.948895+00	2026-10-12 10:45:53.948895+00
106	2	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.950886+00	2026-10-12 10:45:53.950886+00
107	2	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.952911+00	2026-10-12 10:45:53.952911+00
108	2	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.955038+00	2026-10-12 10:45:53.955038+00
109	2	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.957071+00	2026-10-12 10:45:53.957071+00
110	2	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.959191+00	2026-10-12 10:45:53.959191+00
111	2	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.961249+00	2026-10-12 10:45:53.961249+00
112	2	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:53.963269+00	2026-10-12 10:45:53.963269+00
113	2	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:54.032836+00	2026-10-12 10:45:54.032836+00
114	2	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:54.035151+00	2026-10-12 10:45:54.035151+00
115	2	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:54.037324+00	2026-10-12 10:45:54.037324+00
116	2	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:54.039357+00	2026-10-12 10:45:54.039357+00
117	2	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:54.041378+00	2026-10-12 10:45:54.041378+00
118	2	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:45:54.043467+00	2026-10-12 10:45:54.043467+00
119	3	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d10h51m48s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:53.933531+00	2026-10-12 10:55:53.933531+00
120	3	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d1h21m42s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:53.939022+00	2026-10-12 10:55:53.939022+00
122	3	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d1h21m6s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:53.945965+00	2026-10-12 10:55:53.945965+00
123	3	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "13h47m22s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.032431+00	2026-10-12 10:55:54.032431+00
126	3	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "11h54m43s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.039819+00	2026-10-12 10:55:54.039819+00
127	3	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "11h54m22s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.041689+00	2026-10-12 10:55:54.041689+00
128	3	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "11h54m21s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.04356+00	2026-10-12 10:55:54.04356+00
129	3	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "11h54m21s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.045414+00	2026-10-12 10:55:54.045414+00
130	3	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "11h54m16s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.047433+00	2026-10-12 10:55:54.047433+00
158	3	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.236964+00	2026-10-12 10:55:54.236964+00
125	3	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "11h54m47s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.037106+00	2026-10-12 10:55:54.037106+00
124	3	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "11h54m50s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.03501+00	2026-10-12 10:55:54.03501+00
131	3	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "11h54m13s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.049378+00	2026-10-12 10:55:54.049378+00
132	3	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "9h52m14s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.051371+00	2026-10-12 10:55:54.051371+00
133	3	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "9h33m35s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.053275+00	2026-10-12 10:55:54.053275+00
134	3	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "8h45m20s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.055266+00	2026-10-12 10:55:54.055266+00
135	3	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "7h49m11s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.061376+00	2026-10-12 10:55:54.061376+00
136	3	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "6h38m6s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.063964+00	2026-10-12 10:55:54.063964+00
137	3	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "1h39m23s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:54.067475+00	2026-10-12 10:55:54.067475+00
138	3	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.071979+00	2026-10-12 10:55:54.071979+00
139	3	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.130636+00	2026-10-12 10:55:54.130636+00
140	3	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.133966+00	2026-10-12 10:55:54.133966+00
141	3	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.137435+00	2026-10-12 10:55:54.137435+00
142	3	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.140965+00	2026-10-12 10:55:54.140965+00
143	3	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.143965+00	2026-10-12 10:55:54.143965+00
144	3	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.146965+00	2026-10-12 10:55:54.146965+00
145	3	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.149527+00	2026-10-12 10:55:54.149527+00
146	3	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.152965+00	2026-10-12 10:55:54.152965+00
147	3	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.156964+00	2026-10-12 10:55:54.156964+00
148	3	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.159964+00	2026-10-12 10:55:54.159964+00
149	3	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.162964+00	2026-10-12 10:55:54.162964+00
150	3	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.165613+00	2026-10-12 10:55:54.165613+00
151	3	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.167963+00	2026-10-12 10:55:54.167963+00
152	3	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.170965+00	2026-10-12 10:55:54.170965+00
153	3	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.173357+00	2026-10-12 10:55:54.173357+00
154	3	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.175599+00	2026-10-12 10:55:54.175599+00
155	3	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.177868+00	2026-10-12 10:55:54.177868+00
156	3	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.180253+00	2026-10-12 10:55:54.180253+00
157	3	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.232785+00	2026-10-12 10:55:54.232785+00
159	3	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.24076+00	2026-10-12 10:55:54.24076+00
160	3	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.243964+00	2026-10-12 10:55:54.243964+00
161	3	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.246979+00	2026-10-12 10:55:54.246979+00
162	3	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.250895+00	2026-10-12 10:55:54.250895+00
163	3	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.254965+00	2026-10-12 10:55:54.254965+00
164	3	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.258564+00	2026-10-12 10:55:54.258564+00
165	3	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.261818+00	2026-10-12 10:55:54.261818+00
166	3	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.264609+00	2026-10-12 10:55:54.264609+00
167	3	\N	\N	bridge_host	mac_address	A0:7F:09:03:B8:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.267965+00	2026-10-12 10:55:54.267965+00
168	3	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.270966+00	2026-10-12 10:55:54.270966+00
169	3	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.274639+00	2026-10-12 10:55:54.274639+00
170	3	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.277964+00	2026-10-12 10:55:54.277964+00
171	3	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.281965+00	2026-10-12 10:55:54.281965+00
172	3	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.330628+00	2026-10-12 10:55:54.330628+00
173	3	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.383864+00	2026-10-12 10:55:54.383864+00
174	3	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.390769+00	2026-10-12 10:55:54.390769+00
175	3	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.393072+00	2026-10-12 10:55:54.393072+00
176	3	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.414968+00	2026-10-12 10:55:54.414968+00
177	3	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.418762+00	2026-10-12 10:55:54.418762+00
178	3	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 10:55:54.421555+00	2026-10-12 10:55:54.421555+00
179	4	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d10h55m58s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.055229+00	2026-10-12 11:00:03.055229+00
180	4	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d1h25m52s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.087646+00	2026-10-12 11:00:03.087646+00
182	4	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d1h25m16s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.094007+00	2026-10-12 11:00:03.094007+00
183	4	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "13h51m32s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.096802+00	2026-10-12 11:00:03.096802+00
185	4	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "11h58m57s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.103519+00	2026-10-12 11:00:03.103519+00
184	4	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "11h59m", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.099857+00	2026-10-12 11:00:03.099857+00
186	4	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "11h58m53s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.105963+00	2026-10-12 11:00:03.105963+00
187	4	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "11h58m32s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.108799+00	2026-10-12 11:00:03.108799+00
188	4	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "11h58m31s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.11159+00	2026-10-12 11:00:03.11159+00
189	4	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "11h58m31s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.114666+00	2026-10-12 11:00:03.114666+00
190	4	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "11h58m26s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.117594+00	2026-10-12 11:00:03.117594+00
191	4	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "11h58m23s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.120961+00	2026-10-12 11:00:03.120961+00
192	4	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "9h56m24s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.123964+00	2026-10-12 11:00:03.123964+00
193	4	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "9h37m45s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.131964+00	2026-10-12 11:00:03.131964+00
194	4	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "8h49m30s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.134974+00	2026-10-12 11:00:03.134974+00
195	4	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "7h53m21s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.137552+00	2026-10-12 11:00:03.137552+00
196	4	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "6h42m16s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.140964+00	2026-10-12 11:00:03.140964+00
197	4	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "1h43m33s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.186968+00	2026-10-12 11:00:03.186968+00
198	5	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d11h5m57s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.642477+00	2026-10-12 11:10:02.642477+00
199	5	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d1h35m51s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.645435+00	2026-10-12 11:10:02.645435+00
201	5	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d1h35m15s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.649883+00	2026-10-12 11:10:02.649883+00
202	5	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "14h1m31s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.652027+00	2026-10-12 11:10:02.652027+00
205	5	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "12h8m52s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.658191+00	2026-10-12 11:10:02.658191+00
206	5	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "12h8m31s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.660257+00	2026-10-12 11:10:02.660257+00
207	5	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "12h8m30s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.664982+00	2026-10-12 11:10:02.664982+00
208	5	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "12h8m30s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.667129+00	2026-10-12 11:10:02.667129+00
204	5	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "12h8m56s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.656124+00	2026-10-12 11:10:02.656124+00
203	5	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "12h8m59s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.654051+00	2026-10-12 11:10:02.654051+00
209	5	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "12h8m25s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.669279+00	2026-10-12 11:10:02.669279+00
210	5	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "12h8m22s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.730843+00	2026-10-12 11:10:02.730843+00
211	5	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "10h6m23s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.733687+00	2026-10-12 11:10:02.733687+00
212	5	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "9h47m44s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.735967+00	2026-10-12 11:10:02.735967+00
213	5	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "8h59m29s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.737963+00	2026-10-12 11:10:02.737963+00
214	5	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "8h3m20s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.740208+00	2026-10-12 11:10:02.740208+00
215	5	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "6h52m15s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.742253+00	2026-10-12 11:10:02.742253+00
216	5	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "1h53m32s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.74439+00	2026-10-12 11:10:02.74439+00
217	5	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.746915+00	2026-10-12 11:10:02.746915+00
218	5	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.749265+00	2026-10-12 11:10:02.749265+00
219	5	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.751198+00	2026-10-12 11:10:02.751198+00
220	5	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.753395+00	2026-10-12 11:10:02.753395+00
221	5	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.755585+00	2026-10-12 11:10:02.755585+00
222	5	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.757883+00	2026-10-12 11:10:02.757883+00
223	5	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.759962+00	2026-10-12 11:10:02.759962+00
224	5	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.76211+00	2026-10-12 11:10:02.76211+00
225	5	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.765061+00	2026-10-12 11:10:02.765061+00
226	5	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.767373+00	2026-10-12 11:10:02.767373+00
227	5	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.769712+00	2026-10-12 11:10:02.769712+00
228	5	\N	\N	bridge_host	mac_address	3A:50:0A:65:91:23	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.833442+00	2026-10-12 11:10:02.833442+00
229	5	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.836147+00	2026-10-12 11:10:02.836147+00
230	5	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.838516+00	2026-10-12 11:10:02.838516+00
231	5	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.840869+00	2026-10-12 11:10:02.840869+00
232	5	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.843017+00	2026-10-12 11:10:02.843017+00
233	5	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.844966+00	2026-10-12 11:10:02.844966+00
234	5	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.846966+00	2026-10-12 11:10:02.846966+00
235	5	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.848967+00	2026-10-12 11:10:02.848967+00
236	5	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.851218+00	2026-10-12 11:10:02.851218+00
237	5	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.85357+00	2026-10-12 11:10:02.85357+00
238	5	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.855796+00	2026-10-12 11:10:02.855796+00
239	5	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.857965+00	2026-10-12 11:10:02.857965+00
240	5	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.859965+00	2026-10-12 11:10:02.859965+00
241	5	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.861971+00	2026-10-12 11:10:02.861971+00
242	5	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.864014+00	2026-10-12 11:10:02.864014+00
243	5	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.865956+00	2026-10-12 11:10:02.865956+00
244	5	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.867966+00	2026-10-12 11:10:02.867966+00
245	5	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.87022+00	2026-10-12 11:10:02.87022+00
246	5	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.932271+00	2026-10-12 11:10:02.932271+00
247	5	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.935679+00	2026-10-12 11:10:02.935679+00
248	5	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.937916+00	2026-10-12 11:10:02.937916+00
249	5	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.94042+00	2026-10-12 11:10:02.94042+00
250	5	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.944153+00	2026-10-12 11:10:02.944153+00
251	5	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.94629+00	2026-10-12 11:10:02.94629+00
252	5	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.948585+00	2026-10-12 11:10:02.948585+00
253	5	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.951257+00	2026-10-12 11:10:02.951257+00
254	5	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:10:02.953349+00	2026-10-12 11:10:02.953349+00
255	6	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d11h15m57s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.719859+00	2026-10-12 11:20:02.719859+00
256	6	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d1h45m51s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.722722+00	2026-10-12 11:20:02.722722+00
258	6	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d1h45m15s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.727123+00	2026-10-12 11:20:02.727123+00
259	6	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "14h11m31s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.729027+00	2026-10-12 11:20:02.729027+00
288	6	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.84718+00	2026-10-12 11:20:02.84718+00
261	6	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "12h18m56s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.732916+00	2026-10-12 11:20:02.732916+00
260	6	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "12h18m59s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.731018+00	2026-10-12 11:20:02.731018+00
262	6	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "12h18m52s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.734788+00	2026-10-12 11:20:02.734788+00
263	6	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "12h18m31s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.736757+00	2026-10-12 11:20:02.736757+00
264	6	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "12h18m30s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.738698+00	2026-10-12 11:20:02.738698+00
265	6	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "12h18m30s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.740579+00	2026-10-12 11:20:02.740579+00
266	6	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "12h18m25s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.74246+00	2026-10-12 11:20:02.74246+00
267	6	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "12h18m22s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.744249+00	2026-10-12 11:20:02.744249+00
268	6	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "10h16m23s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.746103+00	2026-10-12 11:20:02.746103+00
269	6	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "9h57m44s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.74802+00	2026-10-12 11:20:02.74802+00
270	6	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "9h9m29s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.750007+00	2026-10-12 11:20:02.750007+00
271	6	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "8h13m20s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.752519+00	2026-10-12 11:20:02.752519+00
272	6	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "7h2m15s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.754398+00	2026-10-12 11:20:02.754398+00
273	6	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "2h3m32s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.756453+00	2026-10-12 11:20:02.756453+00
274	6	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.758695+00	2026-10-12 11:20:02.758695+00
275	6	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.76059+00	2026-10-12 11:20:02.76059+00
276	6	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.76261+00	2026-10-12 11:20:02.76261+00
277	6	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.76654+00	2026-10-12 11:20:02.76654+00
278	6	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.768847+00	2026-10-12 11:20:02.768847+00
279	6	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.770861+00	2026-10-12 11:20:02.770861+00
280	6	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.772801+00	2026-10-12 11:20:02.772801+00
281	6	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.833448+00	2026-10-12 11:20:02.833448+00
282	6	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.835595+00	2026-10-12 11:20:02.835595+00
283	6	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.837546+00	2026-10-12 11:20:02.837546+00
284	6	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.839432+00	2026-10-12 11:20:02.839432+00
285	6	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.841353+00	2026-10-12 11:20:02.841353+00
286	6	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.843218+00	2026-10-12 11:20:02.843218+00
287	6	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.845195+00	2026-10-12 11:20:02.845195+00
289	6	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.849102+00	2026-10-12 11:20:02.849102+00
290	6	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.851106+00	2026-10-12 11:20:02.851106+00
291	6	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.853202+00	2026-10-12 11:20:02.853202+00
292	6	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.855513+00	2026-10-12 11:20:02.855513+00
293	6	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.857979+00	2026-10-12 11:20:02.857979+00
294	6	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.860123+00	2026-10-12 11:20:02.860123+00
295	6	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.862134+00	2026-10-12 11:20:02.862134+00
296	6	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.86469+00	2026-10-12 11:20:02.86469+00
297	6	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.866706+00	2026-10-12 11:20:02.866706+00
298	6	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.868817+00	2026-10-12 11:20:02.868817+00
299	6	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.870882+00	2026-10-12 11:20:02.870882+00
300	6	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.934292+00	2026-10-12 11:20:02.934292+00
301	6	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.936846+00	2026-10-12 11:20:02.936846+00
302	6	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.93932+00	2026-10-12 11:20:02.93932+00
303	6	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.941873+00	2026-10-12 11:20:02.941873+00
304	6	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.944562+00	2026-10-12 11:20:02.944562+00
305	6	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.946978+00	2026-10-12 11:20:02.946978+00
306	6	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.949107+00	2026-10-12 11:20:02.949107+00
307	6	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.951521+00	2026-10-12 11:20:02.951521+00
308	6	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.954218+00	2026-10-12 11:20:02.954218+00
309	6	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.956374+00	2026-10-12 11:20:02.956374+00
310	6	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:20:02.958603+00	2026-10-12 11:20:02.958603+00
311	7	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d11h25m57s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.661763+00	2026-10-12 11:30:02.661763+00
312	7	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d1h55m51s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.664676+00	2026-10-12 11:30:02.664676+00
314	7	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d1h55m15s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.668312+00	2026-10-12 11:30:02.668312+00
315	7	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "14h21m31s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.670201+00	2026-10-12 11:30:02.670201+00
318	7	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "12h28m52s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.675911+00	2026-10-12 11:30:02.675911+00
319	7	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "12h28m31s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.677694+00	2026-10-12 11:30:02.677694+00
320	7	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "12h28m30s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.679657+00	2026-10-12 11:30:02.679657+00
321	7	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "12h28m30s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.681415+00	2026-10-12 11:30:02.681415+00
322	7	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "12h28m25s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.683442+00	2026-10-12 11:30:02.683442+00
323	7	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "12h28m22s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.685649+00	2026-10-12 11:30:02.685649+00
324	7	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "10h26m23s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.687497+00	2026-10-12 11:30:02.687497+00
325	7	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "10h7m44s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.689293+00	2026-10-12 11:30:02.689293+00
326	7	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "9h19m29s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.690977+00	2026-10-12 11:30:02.690977+00
327	7	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "8h23m20s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.692979+00	2026-10-12 11:30:02.692979+00
328	7	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "7h12m15s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.694771+00	2026-10-12 11:30:02.694771+00
329	7	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "2h13m32s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.696607+00	2026-10-12 11:30:02.696607+00
330	7	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.698637+00	2026-10-12 11:30:02.698637+00
331	7	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.73064+00	2026-10-12 11:30:02.73064+00
332	7	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.733262+00	2026-10-12 11:30:02.733262+00
333	7	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.735336+00	2026-10-12 11:30:02.735336+00
334	7	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.73734+00	2026-10-12 11:30:02.73734+00
335	7	\N	\N	bridge_host	mac_address	12:05:3F:A2:FE:0D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.739354+00	2026-10-12 11:30:02.739354+00
336	7	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.741398+00	2026-10-12 11:30:02.741398+00
337	7	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.743542+00	2026-10-12 11:30:02.743542+00
338	7	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.745562+00	2026-10-12 11:30:02.745562+00
339	7	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.747546+00	2026-10-12 11:30:02.747546+00
340	7	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.749463+00	2026-10-12 11:30:02.749463+00
316	7	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "12h28m59s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.672099+00	2026-10-12 11:30:02.672099+00
341	7	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.751476+00	2026-10-12 11:30:02.751476+00
342	7	\N	\N	bridge_host	mac_address	3A:C3:E4:51:03:66	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.753523+00	2026-10-12 11:30:02.753523+00
343	7	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.768873+00	2026-10-12 11:30:02.768873+00
344	7	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.771288+00	2026-10-12 11:30:02.771288+00
345	7	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.773283+00	2026-10-12 11:30:02.773283+00
346	7	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.775286+00	2026-10-12 11:30:02.775286+00
347	7	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.832066+00	2026-10-12 11:30:02.832066+00
348	7	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.83423+00	2026-10-12 11:30:02.83423+00
349	7	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.836111+00	2026-10-12 11:30:02.836111+00
350	7	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.837959+00	2026-10-12 11:30:02.837959+00
351	7	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.839691+00	2026-10-12 11:30:02.839691+00
352	7	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.841571+00	2026-10-12 11:30:02.841571+00
353	7	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.843471+00	2026-10-12 11:30:02.843471+00
354	7	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.845424+00	2026-10-12 11:30:02.845424+00
355	7	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.847398+00	2026-10-12 11:30:02.847398+00
356	7	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.849268+00	2026-10-12 11:30:02.849268+00
357	7	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.851395+00	2026-10-12 11:30:02.851395+00
358	7	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.853357+00	2026-10-12 11:30:02.853357+00
359	7	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.855163+00	2026-10-12 11:30:02.855163+00
360	7	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.85726+00	2026-10-12 11:30:02.85726+00
361	7	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.85933+00	2026-10-12 11:30:02.85933+00
362	7	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.86149+00	2026-10-12 11:30:02.86149+00
363	7	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.863332+00	2026-10-12 11:30:02.863332+00
364	7	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.930678+00	2026-10-12 11:30:02.930678+00
365	7	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.933898+00	2026-10-12 11:30:02.933898+00
366	7	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.93648+00	2026-10-12 11:30:02.93648+00
367	7	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:30:02.939069+00	2026-10-12 11:30:02.939069+00
368	8	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d11h27m40s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.248107+00	2026-10-12 11:31:45.248107+00
369	8	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d1h57m34s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.251344+00	2026-10-12 11:31:45.251344+00
371	8	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d1h56m58s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.256204+00	2026-10-12 11:31:45.256204+00
372	8	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "14h23m14s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.258441+00	2026-10-12 11:31:45.258441+00
375	8	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "12h30m35s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.265312+00	2026-10-12 11:31:45.265312+00
376	8	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "12h30m14s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.267248+00	2026-10-12 11:31:45.267248+00
377	8	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "12h30m13s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.269328+00	2026-10-12 11:31:45.269328+00
378	8	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "12h30m13s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.271411+00	2026-10-12 11:31:45.271411+00
379	8	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "12h30m8s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.273589+00	2026-10-12 11:31:45.273589+00
380	8	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "12h30m5s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.275663+00	2026-10-12 11:31:45.275663+00
381	8	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "10h28m6s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.330762+00	2026-10-12 11:31:45.330762+00
382	8	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "10h9m27s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.333664+00	2026-10-12 11:31:45.333664+00
383	8	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "9h21m12s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.336076+00	2026-10-12 11:31:45.336076+00
384	8	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "8h25m3s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.338334+00	2026-10-12 11:31:45.338334+00
385	8	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "7h13m58s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.340537+00	2026-10-12 11:31:45.340537+00
386	8	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "2h15m15s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.342753+00	2026-10-12 11:31:45.342753+00
387	8	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:31:45.356862+00	2026-10-12 11:31:45.356862+00
388	8	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:31:45.362124+00	2026-10-12 11:31:45.362124+00
389	9	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d11h37m39s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.120968+00	2026-10-12 11:41:44.120968+00
390	9	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d2h7m33s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.125629+00	2026-10-12 11:41:44.125629+00
392	9	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d2h6m57s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.132856+00	2026-10-12 11:41:44.132856+00
374	8	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "12h30m39s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.263118+00	2026-10-12 11:31:45.263118+00
373	8	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "12h30m42s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.260709+00	2026-10-12 11:31:45.260709+00
393	9	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "14h33m13s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.135966+00	2026-10-12 11:41:44.135966+00
396	9	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "12h40m34s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.150972+00	2026-10-12 11:41:44.150972+00
397	9	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "12h40m13s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.153973+00	2026-10-12 11:41:44.153973+00
398	9	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "12h40m12s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.156965+00	2026-10-12 11:41:44.156965+00
399	9	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "12h40m12s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.159965+00	2026-10-12 11:41:44.159965+00
400	9	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "12h40m7s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.162964+00	2026-10-12 11:41:44.162964+00
401	9	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "12h40m4s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.167966+00	2026-10-12 11:41:44.167966+00
402	9	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "10h38m5s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.170966+00	2026-10-12 11:41:44.170966+00
403	9	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "10h19m26s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.173681+00	2026-10-12 11:41:44.173681+00
404	9	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "9h31m11s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.176965+00	2026-10-12 11:41:44.176965+00
405	9	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "8h35m2s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.179968+00	2026-10-12 11:41:44.179968+00
406	9	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "7h23m57s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.18268+00	2026-10-12 11:41:44.18268+00
407	9	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "2h25m14s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.185964+00	2026-10-12 11:41:44.185964+00
408	9	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.192966+00	2026-10-12 11:41:44.192966+00
409	9	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.195999+00	2026-10-12 11:41:44.195999+00
410	9	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.198965+00	2026-10-12 11:41:44.198965+00
411	9	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.232967+00	2026-10-12 11:41:44.232967+00
412	9	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.235965+00	2026-10-12 11:41:44.235965+00
413	9	\N	\N	bridge_host	mac_address	12:05:3F:A2:FE:0D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.238966+00	2026-10-12 11:41:44.238966+00
414	9	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.241989+00	2026-10-12 11:41:44.241989+00
415	9	\N	\N	bridge_host	mac_address	2C:FE:4F:94:BD:3F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.244845+00	2026-10-12 11:41:44.244845+00
416	9	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.247499+00	2026-10-12 11:41:44.247499+00
417	9	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.253747+00	2026-10-12 11:41:44.253747+00
394	9	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "12h40m41s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.138973+00	2026-10-12 11:41:44.138973+00
418	9	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.256966+00	2026-10-12 11:41:44.256966+00
419	9	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.259969+00	2026-10-12 11:41:44.259969+00
420	9	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.262964+00	2026-10-12 11:41:44.262964+00
421	9	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.265967+00	2026-10-12 11:41:44.265967+00
422	9	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.268803+00	2026-10-12 11:41:44.268803+00
423	9	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.271966+00	2026-10-12 11:41:44.271966+00
424	9	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.274976+00	2026-10-12 11:41:44.274976+00
425	9	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.277968+00	2026-10-12 11:41:44.277968+00
426	9	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.280965+00	2026-10-12 11:41:44.280965+00
427	9	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.332+00	2026-10-12 11:41:44.332+00
428	9	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.335989+00	2026-10-12 11:41:44.335989+00
429	9	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.339967+00	2026-10-12 11:41:44.339967+00
430	9	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.342653+00	2026-10-12 11:41:44.342653+00
431	9	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.345031+00	2026-10-12 11:41:44.345031+00
432	9	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.348093+00	2026-10-12 11:41:44.348093+00
433	9	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.352629+00	2026-10-12 11:41:44.352629+00
434	9	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.3551+00	2026-10-12 11:41:44.3551+00
435	9	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.357452+00	2026-10-12 11:41:44.357452+00
436	9	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.360027+00	2026-10-12 11:41:44.360027+00
437	9	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.363038+00	2026-10-12 11:41:44.363038+00
438	9	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.365557+00	2026-10-12 11:41:44.365557+00
439	9	\N	\N	bridge_host	mac_address	A0:7F:09:03:B8:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.368027+00	2026-10-12 11:41:44.368027+00
440	9	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.370316+00	2026-10-12 11:41:44.370316+00
441	9	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.372577+00	2026-10-12 11:41:44.372577+00
442	9	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.374989+00	2026-10-12 11:41:44.374989+00
443	9	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.379041+00	2026-10-12 11:41:44.379041+00
444	9	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.381637+00	2026-10-12 11:41:44.381637+00
445	9	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.431003+00	2026-10-12 11:41:44.431003+00
446	9	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.434969+00	2026-10-12 11:41:44.434969+00
447	9	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.437963+00	2026-10-12 11:41:44.437963+00
448	9	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.440964+00	2026-10-12 11:41:44.440964+00
449	9	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.443963+00	2026-10-12 11:41:44.443963+00
450	9	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.446963+00	2026-10-12 11:41:44.446963+00
451	9	\N	\N	bridge_host	mac_address	EA:A1:79:4E:4D:1F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:41:44.450963+00	2026-10-12 11:41:44.450963+00
452	10	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d11h47m39s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.188824+00	2026-10-12 11:51:44.188824+00
453	10	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d2h17m33s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.191272+00	2026-10-12 11:51:44.191272+00
455	10	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d2h16m57s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.195043+00	2026-10-12 11:51:44.195043+00
456	10	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "14h43m13s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.196877+00	2026-10-12 11:51:44.196877+00
459	10	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "12h50m34s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.202519+00	2026-10-12 11:51:44.202519+00
460	10	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "12h50m13s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.20431+00	2026-10-12 11:51:44.20431+00
461	10	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "12h50m12s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.206297+00	2026-10-12 11:51:44.206297+00
462	10	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "12h50m12s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.208084+00	2026-10-12 11:51:44.208084+00
463	10	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "12h50m7s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.209881+00	2026-10-12 11:51:44.209881+00
464	10	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "12h50m4s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.212018+00	2026-10-12 11:51:44.212018+00
465	10	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "10h48m5s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.213867+00	2026-10-12 11:51:44.213867+00
466	10	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "10h29m26s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.215809+00	2026-10-12 11:51:44.215809+00
467	10	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "9h41m11s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.21789+00	2026-10-12 11:51:44.21789+00
468	10	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "8h45m2s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.220011+00	2026-10-12 11:51:44.220011+00
469	10	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "2h35m14s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.223128+00	2026-10-12 11:51:44.223128+00
458	10	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "12h50m38s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.200758+00	2026-10-12 11:51:44.200758+00
457	10	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "12h50m41s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.198825+00	2026-10-12 11:51:44.198825+00
470	10	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "7m11s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.225243+00	2026-10-12 11:51:44.225243+00
471	10	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.227571+00	2026-10-12 11:51:44.227571+00
472	10	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.230593+00	2026-10-12 11:51:44.230593+00
473	10	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.232308+00	2026-10-12 11:51:44.232308+00
474	10	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.234334+00	2026-10-12 11:51:44.234334+00
475	10	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.236365+00	2026-10-12 11:51:44.236365+00
476	10	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.238404+00	2026-10-12 11:51:44.238404+00
477	10	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.240355+00	2026-10-12 11:51:44.240355+00
478	10	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.24248+00	2026-10-12 11:51:44.24248+00
479	10	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.244422+00	2026-10-12 11:51:44.244422+00
480	10	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.268845+00	2026-10-12 11:51:44.268845+00
481	10	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.271518+00	2026-10-12 11:51:44.271518+00
482	10	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.273612+00	2026-10-12 11:51:44.273612+00
483	10	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.2756+00	2026-10-12 11:51:44.2756+00
484	10	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.277583+00	2026-10-12 11:51:44.277583+00
485	10	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.279531+00	2026-10-12 11:51:44.279531+00
486	10	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.281465+00	2026-10-12 11:51:44.281465+00
487	10	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.283494+00	2026-10-12 11:51:44.283494+00
488	10	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.28589+00	2026-10-12 11:51:44.28589+00
489	10	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.331848+00	2026-10-12 11:51:44.331848+00
490	10	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.334317+00	2026-10-12 11:51:44.334317+00
491	10	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.33654+00	2026-10-12 11:51:44.33654+00
492	10	\N	\N	bridge_host	mac_address	5A:4C:CC:2C:B6:41	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.338667+00	2026-10-12 11:51:44.338667+00
493	10	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.340783+00	2026-10-12 11:51:44.340783+00
494	10	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.342869+00	2026-10-12 11:51:44.342869+00
495	10	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.344966+00	2026-10-12 11:51:44.344966+00
496	10	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.347033+00	2026-10-12 11:51:44.347033+00
497	10	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.350966+00	2026-10-12 11:51:44.350966+00
498	10	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.354265+00	2026-10-12 11:51:44.354265+00
499	10	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.356602+00	2026-10-12 11:51:44.356602+00
500	10	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.358599+00	2026-10-12 11:51:44.358599+00
501	10	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.360501+00	2026-10-12 11:51:44.360501+00
502	10	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.36236+00	2026-10-12 11:51:44.36236+00
503	10	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.364295+00	2026-10-12 11:51:44.364295+00
504	10	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.36891+00	2026-10-12 11:51:44.36891+00
505	10	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.43074+00	2026-10-12 11:51:44.43074+00
506	10	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.433723+00	2026-10-12 11:51:44.433723+00
507	10	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.435962+00	2026-10-12 11:51:44.435962+00
508	10	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.437985+00	2026-10-12 11:51:44.437985+00
509	10	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.439995+00	2026-10-12 11:51:44.439995+00
510	10	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.441834+00	2026-10-12 11:51:44.441834+00
511	10	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 11:51:44.44377+00	2026-10-12 11:51:44.44377+00
512	11	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d11h57m39s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.164743+00	2026-10-12 12:01:44.164743+00
513	11	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d2h27m33s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.167774+00	2026-10-12 12:01:44.167774+00
515	11	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d2h26m57s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.171756+00	2026-10-12 12:01:44.171756+00
516	11	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "14h53m13s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.173753+00	2026-10-12 12:01:44.173753+00
519	11	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h34s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.179689+00	2026-10-12 12:01:44.179689+00
520	11	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h13s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.18135+00	2026-10-12 12:01:44.18135+00
521	11	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h12s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.183115+00	2026-10-12 12:01:44.183115+00
522	11	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h12s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.184964+00	2026-10-12 12:01:44.184964+00
523	11	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h7s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.186986+00	2026-10-12 12:01:44.186986+00
518	11	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h38s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.177832+00	2026-10-12 12:01:44.177832+00
517	11	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h41s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.175784+00	2026-10-12 12:01:44.175784+00
524	11	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h4s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.188957+00	2026-10-12 12:01:44.188957+00
525	11	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "10h58m5s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.190892+00	2026-10-12 12:01:44.190892+00
526	11	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "10h39m26s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.192685+00	2026-10-12 12:01:44.192685+00
527	11	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "9h51m11s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.194639+00	2026-10-12 12:01:44.194639+00
528	11	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "8h55m2s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.196393+00	2026-10-12 12:01:44.196393+00
529	11	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "2h45m14s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.198197+00	2026-10-12 12:01:44.198197+00
530	11	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "17m11s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.199946+00	2026-10-12 12:01:44.199946+00
531	11	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.230605+00	2026-10-12 12:01:44.230605+00
532	11	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.233411+00	2026-10-12 12:01:44.233411+00
533	11	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.235513+00	2026-10-12 12:01:44.235513+00
534	11	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.2377+00	2026-10-12 12:01:44.2377+00
535	11	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.239704+00	2026-10-12 12:01:44.239704+00
536	11	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.241644+00	2026-10-12 12:01:44.241644+00
537	11	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.243737+00	2026-10-12 12:01:44.243737+00
538	11	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.245817+00	2026-10-12 12:01:44.245817+00
539	11	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.247882+00	2026-10-12 12:01:44.247882+00
540	11	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.249858+00	2026-10-12 12:01:44.249858+00
541	11	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.251838+00	2026-10-12 12:01:44.251838+00
542	11	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.253827+00	2026-10-12 12:01:44.253827+00
543	11	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.255987+00	2026-10-12 12:01:44.255987+00
544	11	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.258199+00	2026-10-12 12:01:44.258199+00
545	11	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.269741+00	2026-10-12 12:01:44.269741+00
546	11	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.272084+00	2026-10-12 12:01:44.272084+00
547	11	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.274201+00	2026-10-12 12:01:44.274201+00
548	11	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.276404+00	2026-10-12 12:01:44.276404+00
549	11	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.331902+00	2026-10-12 12:01:44.331902+00
550	11	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.334086+00	2026-10-12 12:01:44.334086+00
551	11	\N	\N	bridge_host	mac_address	5A:4C:CC:2C:B6:41	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.336613+00	2026-10-12 12:01:44.336613+00
552	11	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.338775+00	2026-10-12 12:01:44.338775+00
553	11	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.340816+00	2026-10-12 12:01:44.340816+00
554	11	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.342853+00	2026-10-12 12:01:44.342853+00
555	11	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.344867+00	2026-10-12 12:01:44.344867+00
556	11	\N	\N	bridge_host	mac_address	80:35:C1:E5:60:FC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.346843+00	2026-10-12 12:01:44.346843+00
557	11	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.34878+00	2026-10-12 12:01:44.34878+00
558	11	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.350772+00	2026-10-12 12:01:44.350772+00
559	11	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.353084+00	2026-10-12 12:01:44.353084+00
560	11	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.390768+00	2026-10-12 12:01:44.390768+00
561	11	\N	\N	bridge_host	mac_address	A0:7F:09:03:B8:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.393562+00	2026-10-12 12:01:44.393562+00
562	11	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.396334+00	2026-10-12 12:01:44.396334+00
563	11	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.398662+00	2026-10-12 12:01:44.398662+00
564	11	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.432566+00	2026-10-12 12:01:44.432566+00
565	11	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.435091+00	2026-10-12 12:01:44.435091+00
566	11	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.43838+00	2026-10-12 12:01:44.43838+00
567	11	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.440632+00	2026-10-12 12:01:44.440632+00
568	11	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.442695+00	2026-10-12 12:01:44.442695+00
569	11	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.444969+00	2026-10-12 12:01:44.444969+00
570	11	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.44782+00	2026-10-12 12:01:44.44782+00
571	11	\N	\N	bridge_host	mac_address	D2:9D:98:57:C8:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.450055+00	2026-10-12 12:01:44.450055+00
572	11	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.452091+00	2026-10-12 12:01:44.452091+00
573	11	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:01:44.454093+00	2026-10-12 12:01:44.454093+00
574	12	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d11h59m51s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.821415+00	2026-10-12 12:03:56.821415+00
575	12	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d2h29m45s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.824449+00	2026-10-12 12:03:56.824449+00
577	12	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d2h29m9s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.828795+00	2026-10-12 12:03:56.828795+00
578	12	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "14h55m25s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.8309+00	2026-10-12 12:03:56.8309+00
581	12	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h2m46s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.837198+00	2026-10-12 12:03:56.837198+00
582	12	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h2m25s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.839257+00	2026-10-12 12:03:56.839257+00
583	12	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h2m24s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.8413+00	2026-10-12 12:03:56.8413+00
584	12	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h2m24s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.84329+00	2026-10-12 12:03:56.84329+00
585	12	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h2m19s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.84533+00	2026-10-12 12:03:56.84533+00
586	12	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h2m16s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.847444+00	2026-10-12 12:03:56.847444+00
587	12	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h17s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.849492+00	2026-10-12 12:03:56.849492+00
588	12	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "10h41m38s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.85148+00	2026-10-12 12:03:56.85148+00
589	12	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "9h53m23s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.853444+00	2026-10-12 12:03:56.853444+00
590	12	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "8h57m14s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.855433+00	2026-10-12 12:03:56.855433+00
591	12	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "2h47m26s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.857416+00	2026-10-12 12:03:56.857416+00
592	12	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "19m23s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.859394+00	2026-10-12 12:03:56.859394+00
593	12	\N	\N	bridge_host	mac_address	14:47:2D:3D:5D:CF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:03:56.864486+00	2026-10-12 12:03:56.864486+00
594	13	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d12h9m49s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.326659+00	2026-10-12 12:13:54.326659+00
595	13	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d2h39m43s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.329328+00	2026-10-12 12:13:54.329328+00
597	13	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d2h39m7s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.333365+00	2026-10-12 12:13:54.333365+00
598	13	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h5m23s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.335262+00	2026-10-12 12:13:54.335262+00
580	12	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h2m50s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.835035+00	2026-10-12 12:03:56.835035+00
579	12	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h2m53s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.8331+00	2026-10-12 12:03:56.8331+00
599	13	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h12m51s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.337121+00	2026-10-12 12:13:54.337121+00
601	13	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h12m44s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.340872+00	2026-10-12 12:13:54.340872+00
602	13	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h12m23s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.342835+00	2026-10-12 12:13:54.342835+00
603	13	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h12m22s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.344626+00	2026-10-12 12:13:54.344626+00
604	13	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h12m22s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.346431+00	2026-10-12 12:13:54.346431+00
605	13	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h12m17s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.348261+00	2026-10-12 12:13:54.348261+00
606	13	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h12m14s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.350029+00	2026-10-12 12:13:54.350029+00
607	13	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h10m15s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.352043+00	2026-10-12 12:13:54.352043+00
608	13	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "10h51m36s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.353964+00	2026-10-12 12:13:54.353964+00
609	13	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h3m21s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.355909+00	2026-10-12 12:13:54.355909+00
610	13	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "9h7m12s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.35791+00	2026-10-12 12:13:54.35791+00
611	13	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "2h57m24s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.359704+00	2026-10-12 12:13:54.359704+00
612	13	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "29m21s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.361574+00	2026-10-12 12:13:54.361574+00
613	13	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.363728+00	2026-10-12 12:13:54.363728+00
614	13	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.365674+00	2026-10-12 12:13:54.365674+00
615	13	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.367676+00	2026-10-12 12:13:54.367676+00
616	13	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.369603+00	2026-10-12 12:13:54.369603+00
617	13	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.371456+00	2026-10-12 12:13:54.371456+00
618	13	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.373373+00	2026-10-12 12:13:54.373373+00
619	13	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.375246+00	2026-10-12 12:13:54.375246+00
620	13	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.432966+00	2026-10-12 12:13:54.432966+00
621	13	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.436965+00	2026-10-12 12:13:54.436965+00
622	13	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.440966+00	2026-10-12 12:13:54.440966+00
623	13	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.444967+00	2026-10-12 12:13:54.444967+00
624	13	\N	\N	bridge_host	mac_address	3A:09:AC:B2:06:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.447432+00	2026-10-12 12:13:54.447432+00
625	13	\N	\N	bridge_host	mac_address	3A:C3:E4:51:03:66	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.449452+00	2026-10-12 12:13:54.449452+00
626	13	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.451394+00	2026-10-12 12:13:54.451394+00
627	13	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.453267+00	2026-10-12 12:13:54.453267+00
628	13	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.45563+00	2026-10-12 12:13:54.45563+00
629	13	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.457661+00	2026-10-12 12:13:54.457661+00
630	13	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.459508+00	2026-10-12 12:13:54.459508+00
631	13	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.461448+00	2026-10-12 12:13:54.461448+00
632	13	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.463267+00	2026-10-12 12:13:54.463267+00
633	13	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.465108+00	2026-10-12 12:13:54.465108+00
634	13	\N	\N	bridge_host	mac_address	56:05:54:74:CF:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.46705+00	2026-10-12 12:13:54.46705+00
635	13	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.468913+00	2026-10-12 12:13:54.468913+00
636	13	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.532372+00	2026-10-12 12:13:54.532372+00
637	13	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.534377+00	2026-10-12 12:13:54.534377+00
638	13	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.536332+00	2026-10-12 12:13:54.536332+00
639	13	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.538161+00	2026-10-12 12:13:54.538161+00
640	13	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.540046+00	2026-10-12 12:13:54.540046+00
641	13	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.542106+00	2026-10-12 12:13:54.542106+00
642	13	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.544026+00	2026-10-12 12:13:54.544026+00
643	13	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.546085+00	2026-10-12 12:13:54.546085+00
644	13	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.548132+00	2026-10-12 12:13:54.548132+00
645	13	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.550372+00	2026-10-12 12:13:54.550372+00
646	13	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.552381+00	2026-10-12 12:13:54.552381+00
647	13	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.55438+00	2026-10-12 12:13:54.55438+00
648	13	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.556383+00	2026-10-12 12:13:54.556383+00
649	13	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.558478+00	2026-10-12 12:13:54.558478+00
650	13	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.560498+00	2026-10-12 12:13:54.560498+00
651	13	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.562596+00	2026-10-12 12:13:54.562596+00
652	13	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:13:54.564707+00	2026-10-12 12:13:54.564707+00
653	14	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d12h19m49s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.387587+00	2026-10-12 12:23:54.387587+00
654	14	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d2h49m43s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.390349+00	2026-10-12 12:23:54.390349+00
656	14	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d2h49m7s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.39414+00	2026-10-12 12:23:54.39414+00
657	14	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h15m23s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.396204+00	2026-10-12 12:23:54.396204+00
660	14	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h22m44s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.402632+00	2026-10-12 12:23:54.402632+00
661	14	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h22m23s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.404748+00	2026-10-12 12:23:54.404748+00
662	14	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h22m22s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.406817+00	2026-10-12 12:23:54.406817+00
663	14	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h22m22s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.408695+00	2026-10-12 12:23:54.408695+00
664	14	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h22m17s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.410509+00	2026-10-12 12:23:54.410509+00
665	14	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h22m14s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.413002+00	2026-10-12 12:23:54.413002+00
666	14	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h20m15s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.414903+00	2026-10-12 12:23:54.414903+00
667	14	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h1m36s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.417698+00	2026-10-12 12:23:54.417698+00
668	14	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h13m21s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.432459+00	2026-10-12 12:23:54.432459+00
669	14	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "9h17m12s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.434601+00	2026-10-12 12:23:54.434601+00
670	14	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.240", "uptime": "3h7m24s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.436486+00	2026-10-12 12:23:54.436486+00
671	14	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "1m34s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.438439+00	2026-10-12 12:23:54.438439+00
672	14	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.44074+00	2026-10-12 12:23:54.44074+00
673	14	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.44282+00	2026-10-12 12:23:54.44282+00
674	14	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.444665+00	2026-10-12 12:23:54.444665+00
675	14	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.446616+00	2026-10-12 12:23:54.446616+00
676	14	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.469794+00	2026-10-12 12:23:54.469794+00
677	14	\N	\N	bridge_host	mac_address	12:05:3F:A2:FE:0D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.471807+00	2026-10-12 12:23:54.471807+00
678	14	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.473764+00	2026-10-12 12:23:54.473764+00
679	14	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.475794+00	2026-10-12 12:23:54.475794+00
659	14	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h22m48s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.400518+00	2026-10-12 12:23:54.400518+00
658	14	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h22m51s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.398309+00	2026-10-12 12:23:54.398309+00
680	14	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.477584+00	2026-10-12 12:23:54.477584+00
681	14	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.479496+00	2026-10-12 12:23:54.479496+00
682	14	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.481283+00	2026-10-12 12:23:54.481283+00
683	14	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.483121+00	2026-10-12 12:23:54.483121+00
684	14	\N	\N	bridge_host	mac_address	3A:09:AC:B2:06:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.484911+00	2026-10-12 12:23:54.484911+00
685	14	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.531613+00	2026-10-12 12:23:54.531613+00
686	14	\N	\N	bridge_host	mac_address	40:45:DA:B6:61:24	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.533545+00	2026-10-12 12:23:54.533545+00
687	14	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.535513+00	2026-10-12 12:23:54.535513+00
688	14	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.537473+00	2026-10-12 12:23:54.537473+00
689	14	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.539232+00	2026-10-12 12:23:54.539232+00
690	14	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.541028+00	2026-10-12 12:23:54.541028+00
691	14	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.542988+00	2026-10-12 12:23:54.542988+00
692	14	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.545115+00	2026-10-12 12:23:54.545115+00
693	14	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.547476+00	2026-10-12 12:23:54.547476+00
694	14	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.550048+00	2026-10-12 12:23:54.550048+00
695	14	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.552431+00	2026-10-12 12:23:54.552431+00
696	14	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.554536+00	2026-10-12 12:23:54.554536+00
697	14	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.55656+00	2026-10-12 12:23:54.55656+00
698	14	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.558532+00	2026-10-12 12:23:54.558532+00
699	14	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.560473+00	2026-10-12 12:23:54.560473+00
700	14	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.631846+00	2026-10-12 12:23:54.631846+00
701	14	\N	\N	bridge_host	mac_address	82:47:DE:66:04:4F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.634306+00	2026-10-12 12:23:54.634306+00
702	14	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.636443+00	2026-10-12 12:23:54.636443+00
703	14	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.638283+00	2026-10-12 12:23:54.638283+00
704	14	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.640158+00	2026-10-12 12:23:54.640158+00
705	14	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.642038+00	2026-10-12 12:23:54.642038+00
706	14	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.644138+00	2026-10-12 12:23:54.644138+00
707	14	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.646057+00	2026-10-12 12:23:54.646057+00
708	14	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.648093+00	2026-10-12 12:23:54.648093+00
709	14	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.650118+00	2026-10-12 12:23:54.650118+00
710	14	\N	\N	bridge_host	mac_address	C6:E3:2F:EA:C0:C5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.65205+00	2026-10-12 12:23:54.65205+00
711	14	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.654043+00	2026-10-12 12:23:54.654043+00
712	14	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.655924+00	2026-10-12 12:23:54.655924+00
713	14	\N	\N	bridge_host	mac_address	DA:F5:A4:7E:E1:93	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.657807+00	2026-10-12 12:23:54.657807+00
714	14	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.659779+00	2026-10-12 12:23:54.659779+00
715	14	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:23:54.661892+00	2026-10-12 12:23:54.661892+00
716	15	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d12h29m49s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.947257+00	2026-10-12 12:33:54.947257+00
717	15	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d2h59m43s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.950516+00	2026-10-12 12:33:54.950516+00
719	15	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d2h59m7s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.954516+00	2026-10-12 12:33:54.954516+00
720	15	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h25m23s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.95647+00	2026-10-12 12:33:54.95647+00
723	15	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h32m44s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.961823+00	2026-10-12 12:33:54.961823+00
724	15	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h32m23s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.963626+00	2026-10-12 12:33:54.963626+00
725	15	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h32m22s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.965472+00	2026-10-12 12:33:54.965472+00
726	15	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h32m22s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.967324+00	2026-10-12 12:33:54.967324+00
727	15	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h32m17s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.969227+00	2026-10-12 12:33:54.969227+00
728	15	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h32m14s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.971103+00	2026-10-12 12:33:54.971103+00
729	15	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h30m15s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.97568+00	2026-10-12 12:33:54.97568+00
730	15	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h11m36s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.977614+00	2026-10-12 12:33:54.977614+00
731	15	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h23m21s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.979429+00	2026-10-12 12:33:54.979429+00
760	15	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.1555+00	2026-10-12 12:33:55.1555+00
722	15	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h32m48s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.960017+00	2026-10-12 12:33:54.960017+00
721	15	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h32m51s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.958148+00	2026-10-12 12:33:54.958148+00
732	15	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "9h27m12s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.981722+00	2026-10-12 12:33:54.981722+00
733	15	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "5m8s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:55.032889+00	2026-10-12 12:33:55.032889+00
734	15	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "1m48s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:55.034909+00	2026-10-12 12:33:55.034909+00
735	15	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.037417+00	2026-10-12 12:33:55.037417+00
736	15	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.03963+00	2026-10-12 12:33:55.03963+00
737	15	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.041549+00	2026-10-12 12:33:55.041549+00
738	15	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.044425+00	2026-10-12 12:33:55.044425+00
739	15	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.047592+00	2026-10-12 12:33:55.047592+00
740	15	\N	\N	bridge_host	mac_address	0E:39:C2:D3:79:42	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.049521+00	2026-10-12 12:33:55.049521+00
741	15	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.051322+00	2026-10-12 12:33:55.051322+00
742	15	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.053195+00	2026-10-12 12:33:55.053195+00
743	15	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.055025+00	2026-10-12 12:33:55.055025+00
744	15	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.056851+00	2026-10-12 12:33:55.056851+00
745	15	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.058702+00	2026-10-12 12:33:55.058702+00
746	15	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.060671+00	2026-10-12 12:33:55.060671+00
747	15	\N	\N	bridge_host	mac_address	36:7D:C4:BA:3C:B2	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.062852+00	2026-10-12 12:33:55.062852+00
748	15	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.132027+00	2026-10-12 12:33:55.132027+00
749	15	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.134078+00	2026-10-12 12:33:55.134078+00
750	15	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.136086+00	2026-10-12 12:33:55.136086+00
751	15	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.137861+00	2026-10-12 12:33:55.137861+00
752	15	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.139672+00	2026-10-12 12:33:55.139672+00
753	15	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.14142+00	2026-10-12 12:33:55.14142+00
754	15	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.143998+00	2026-10-12 12:33:55.143998+00
755	15	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.145902+00	2026-10-12 12:33:55.145902+00
756	15	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.147644+00	2026-10-12 12:33:55.147644+00
757	15	\N	\N	bridge_host	mac_address	5A:4C:CC:2C:B6:41	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.149491+00	2026-10-12 12:33:55.149491+00
758	15	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.151348+00	2026-10-12 12:33:55.151348+00
759	15	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.153219+00	2026-10-12 12:33:55.153219+00
761	15	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.157394+00	2026-10-12 12:33:55.157394+00
762	15	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.159259+00	2026-10-12 12:33:55.159259+00
763	15	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.161037+00	2026-10-12 12:33:55.161037+00
764	15	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.162821+00	2026-10-12 12:33:55.162821+00
765	15	\N	\N	bridge_host	mac_address	9E:7F:C1:C5:00:66	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.230624+00	2026-10-12 12:33:55.230624+00
766	15	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.233274+00	2026-10-12 12:33:55.233274+00
767	15	\N	\N	bridge_host	mac_address	A0:7F:09:03:B8:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.235472+00	2026-10-12 12:33:55.235472+00
768	15	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.23754+00	2026-10-12 12:33:55.23754+00
769	15	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.239586+00	2026-10-12 12:33:55.239586+00
770	15	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.242036+00	2026-10-12 12:33:55.242036+00
771	15	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.243997+00	2026-10-12 12:33:55.243997+00
772	15	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.245968+00	2026-10-12 12:33:55.245968+00
773	15	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.247846+00	2026-10-12 12:33:55.247846+00
774	15	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.249728+00	2026-10-12 12:33:55.249728+00
775	15	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.251659+00	2026-10-12 12:33:55.251659+00
776	15	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.253535+00	2026-10-12 12:33:55.253535+00
777	15	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.255459+00	2026-10-12 12:33:55.255459+00
778	15	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:33:55.257247+00	2026-10-12 12:33:55.257247+00
779	16	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d12h39m49s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.604719+00	2026-10-12 12:43:54.604719+00
780	16	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h9m43s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.607823+00	2026-10-12 12:43:54.607823+00
782	16	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h9m7s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.611916+00	2026-10-12 12:43:54.611916+00
783	16	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h35m23s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.613882+00	2026-10-12 12:43:54.613882+00
786	16	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h42m44s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.619929+00	2026-10-12 12:43:54.619929+00
785	16	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h42m48s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.617961+00	2026-10-12 12:43:54.617961+00
784	16	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h42m51s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.616004+00	2026-10-12 12:43:54.616004+00
787	16	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h42m23s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.621832+00	2026-10-12 12:43:54.621832+00
788	16	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h42m22s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.623814+00	2026-10-12 12:43:54.623814+00
789	16	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h42m22s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.625684+00	2026-10-12 12:43:54.625684+00
790	16	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h42m17s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.627499+00	2026-10-12 12:43:54.627499+00
791	16	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h42m14s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.629422+00	2026-10-12 12:43:54.629422+00
792	16	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h40m15s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.631342+00	2026-10-12 12:43:54.631342+00
793	16	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h21m36s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.633224+00	2026-10-12 12:43:54.633224+00
794	16	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h33m21s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.63515+00	2026-10-12 12:43:54.63515+00
795	16	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "9h37m12s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.636914+00	2026-10-12 12:43:54.636914+00
796	16	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "15m8s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.638884+00	2026-10-12 12:43:54.638884+00
797	16	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "11m48s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.640793+00	2026-10-12 12:43:54.640793+00
798	16	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.643168+00	2026-10-12 12:43:54.643168+00
799	16	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.645884+00	2026-10-12 12:43:54.645884+00
800	16	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.647894+00	2026-10-12 12:43:54.647894+00
801	16	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.649781+00	2026-10-12 12:43:54.649781+00
802	16	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.651775+00	2026-10-12 12:43:54.651775+00
803	16	\N	\N	bridge_host	mac_address	0E:39:C2:D3:79:42	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.671653+00	2026-10-12 12:43:54.671653+00
804	16	\N	\N	bridge_host	mac_address	12:05:3F:A2:FE:0D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.673687+00	2026-10-12 12:43:54.673687+00
805	16	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.67559+00	2026-10-12 12:43:54.67559+00
806	16	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.677529+00	2026-10-12 12:43:54.677529+00
807	16	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.679487+00	2026-10-12 12:43:54.679487+00
808	16	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.681655+00	2026-10-12 12:43:54.681655+00
809	16	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.683517+00	2026-10-12 12:43:54.683517+00
810	16	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.732305+00	2026-10-12 12:43:54.732305+00
811	16	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.734786+00	2026-10-12 12:43:54.734786+00
812	16	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.737165+00	2026-10-12 12:43:54.737165+00
813	16	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.739353+00	2026-10-12 12:43:54.739353+00
814	16	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.741481+00	2026-10-12 12:43:54.741481+00
815	16	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.743487+00	2026-10-12 12:43:54.743487+00
816	16	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.745462+00	2026-10-12 12:43:54.745462+00
817	16	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.747452+00	2026-10-12 12:43:54.747452+00
818	16	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.749895+00	2026-10-12 12:43:54.749895+00
819	16	\N	\N	bridge_host	mac_address	4E:A6:D3:20:14:AF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.752784+00	2026-10-12 12:43:54.752784+00
820	16	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.755969+00	2026-10-12 12:43:54.755969+00
821	16	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.757907+00	2026-10-12 12:43:54.757907+00
822	16	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.75985+00	2026-10-12 12:43:54.75985+00
823	16	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.761879+00	2026-10-12 12:43:54.761879+00
824	16	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.764007+00	2026-10-12 12:43:54.764007+00
825	16	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.765898+00	2026-10-12 12:43:54.765898+00
826	16	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.767888+00	2026-10-12 12:43:54.767888+00
827	16	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.832+00	2026-10-12 12:43:54.832+00
828	16	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.83498+00	2026-10-12 12:43:54.83498+00
829	16	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.837461+00	2026-10-12 12:43:54.837461+00
830	16	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.839633+00	2026-10-12 12:43:54.839633+00
831	16	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.841693+00	2026-10-12 12:43:54.841693+00
832	16	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.844271+00	2026-10-12 12:43:54.844271+00
833	16	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.846466+00	2026-10-12 12:43:54.846466+00
834	16	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.848558+00	2026-10-12 12:43:54.848558+00
835	16	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.851072+00	2026-10-12 12:43:54.851072+00
836	16	\N	\N	bridge_host	mac_address	C6:E3:2F:EA:C0:C5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.853548+00	2026-10-12 12:43:54.853548+00
837	16	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.855603+00	2026-10-12 12:43:54.855603+00
838	16	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.85768+00	2026-10-12 12:43:54.85768+00
839	16	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:43:54.85972+00	2026-10-12 12:43:54.85972+00
840	17	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d12h43m55s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.780023+00	2026-10-12 12:48:00.780023+00
841	17	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h13m49s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.78409+00	2026-10-12 12:48:00.78409+00
843	17	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h13m13s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.789192+00	2026-10-12 12:48:00.789192+00
844	17	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h39m29s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.79145+00	2026-10-12 12:48:00.79145+00
847	17	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h46m50s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.79851+00	2026-10-12 12:48:00.79851+00
848	17	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h46m29s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.800592+00	2026-10-12 12:48:00.800592+00
849	17	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h46m28s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.803566+00	2026-10-12 12:48:00.803566+00
850	17	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h46m28s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.805704+00	2026-10-12 12:48:00.805704+00
851	17	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h46m23s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.807726+00	2026-10-12 12:48:00.807726+00
852	17	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h46m20s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.809709+00	2026-10-12 12:48:00.809709+00
853	17	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h44m21s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.81193+00	2026-10-12 12:48:00.81193+00
854	17	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h25m42s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.832326+00	2026-10-12 12:48:00.832326+00
855	17	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h37m27s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.835051+00	2026-10-12 12:48:00.835051+00
856	17	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "9h41m18s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.8374+00	2026-10-12 12:48:00.8374+00
857	17	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "19m14s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.840846+00	2026-10-12 12:48:00.840846+00
858	17	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "15m54s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.842978+00	2026-10-12 12:48:00.842978+00
859	17	\N	\N	bridge_host	mac_address	12:24:C3:C6:78:2B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:48:00.872343+00	2026-10-12 12:48:00.872343+00
860	17	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:48:00.883469+00	2026-10-12 12:48:00.883469+00
861	17	\N	\N	bridge_host	mac_address	80:35:C1:E5:60:FC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:48:00.935384+00	2026-10-12 12:48:00.935384+00
862	17	\N	\N	bridge_host	mac_address	A0:7F:09:03:B8:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:48:00.943094+00	2026-10-12 12:48:00.943094+00
863	17	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:48:00.952972+00	2026-10-12 12:48:00.952972+00
864	17	\N	\N	bridge_host	mac_address	EE:5B:19:B2:22:EC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:48:00.958965+00	2026-10-12 12:48:00.958965+00
846	17	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h46m54s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.795887+00	2026-10-12 12:48:00.795887+00
845	17	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h46m57s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.793779+00	2026-10-12 12:48:00.793779+00
865	17	\N	\N	bridge_host	mac_address	F2:31:7E:C2:DA:C8	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:48:00.970698+00	2026-10-12 12:48:00.970698+00
866	18	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d12h48m56s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.587812+00	2026-10-12 12:53:01.587812+00
867	18	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h18m50s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.590758+00	2026-10-12 12:53:01.590758+00
869	18	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h18m14s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.595386+00	2026-10-12 12:53:01.595386+00
870	18	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h44m30s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.597399+00	2026-10-12 12:53:01.597399+00
873	18	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h51m51s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.60341+00	2026-10-12 12:53:01.60341+00
874	18	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h51m30s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.605255+00	2026-10-12 12:53:01.605255+00
875	18	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h51m29s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.607702+00	2026-10-12 12:53:01.607702+00
876	18	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h51m29s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.609745+00	2026-10-12 12:53:01.609745+00
877	18	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h51m24s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.611754+00	2026-10-12 12:53:01.611754+00
878	18	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h51m21s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.613748+00	2026-10-12 12:53:01.613748+00
879	18	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h49m22s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.615721+00	2026-10-12 12:53:01.615721+00
880	18	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h30m43s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.617775+00	2026-10-12 12:53:01.617775+00
881	18	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h42m28s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.620836+00	2026-10-12 12:53:01.620836+00
882	18	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "9h46m19s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.623747+00	2026-10-12 12:53:01.623747+00
883	18	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "24m15s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.625884+00	2026-10-12 12:53:01.625884+00
884	18	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.632787+00	2026-10-12 12:53:01.632787+00
885	18	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.635487+00	2026-10-12 12:53:01.635487+00
886	18	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.637573+00	2026-10-12 12:53:01.637573+00
887	18	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.639569+00	2026-10-12 12:53:01.639569+00
888	18	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.641619+00	2026-10-12 12:53:01.641619+00
872	18	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h51m55s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.601395+00	2026-10-12 12:53:01.601395+00
871	18	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h51m58s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.599384+00	2026-10-12 12:53:01.599384+00
889	18	\N	\N	bridge_host	mac_address	0E:39:C2:D3:79:42	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.64379+00	2026-10-12 12:53:01.64379+00
890	18	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.669009+00	2026-10-12 12:53:01.669009+00
891	18	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.672053+00	2026-10-12 12:53:01.672053+00
892	18	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.674697+00	2026-10-12 12:53:01.674697+00
893	18	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.676872+00	2026-10-12 12:53:01.676872+00
894	18	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.679219+00	2026-10-12 12:53:01.679219+00
895	18	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.68143+00	2026-10-12 12:53:01.68143+00
896	18	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.683919+00	2026-10-12 12:53:01.683919+00
897	18	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.732553+00	2026-10-12 12:53:01.732553+00
898	18	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.736461+00	2026-10-12 12:53:01.736461+00
899	18	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.769872+00	2026-10-12 12:53:01.769872+00
900	18	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.776092+00	2026-10-12 12:53:01.776092+00
901	18	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.832023+00	2026-10-12 12:53:01.832023+00
902	18	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.835179+00	2026-10-12 12:53:01.835179+00
903	18	\N	\N	bridge_host	mac_address	4E:A6:D3:20:14:AF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.837243+00	2026-10-12 12:53:01.837243+00
904	18	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.83914+00	2026-10-12 12:53:01.83914+00
905	18	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.841033+00	2026-10-12 12:53:01.841033+00
906	18	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.84292+00	2026-10-12 12:53:01.84292+00
907	18	\N	\N	bridge_host	mac_address	7A:09:27:20:D1:D0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.845181+00	2026-10-12 12:53:01.845181+00
908	18	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.847719+00	2026-10-12 12:53:01.847719+00
909	18	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:01.932365+00	2026-10-12 12:53:01.932365+00
910	18	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.032106+00	2026-10-12 12:53:02.032106+00
911	18	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.132137+00	2026-10-12 12:53:02.132137+00
912	18	\N	\N	bridge_host	mac_address	9E:7F:C1:C5:00:66	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.135476+00	2026-10-12 12:53:02.135476+00
913	18	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.232455+00	2026-10-12 12:53:02.232455+00
914	18	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.333045+00	2026-10-12 12:53:02.333045+00
915	18	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.430652+00	2026-10-12 12:53:02.430652+00
916	18	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.434314+00	2026-10-12 12:53:02.434314+00
917	18	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.532447+00	2026-10-12 12:53:02.532447+00
918	18	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.535518+00	2026-10-12 12:53:02.535518+00
919	18	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.537756+00	2026-10-12 12:53:02.537756+00
920	18	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.630629+00	2026-10-12 12:53:02.630629+00
921	18	\N	\N	bridge_host	mac_address	C6:E3:2F:EA:C0:C5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.633292+00	2026-10-12 12:53:02.633292+00
922	18	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.636172+00	2026-10-12 12:53:02.636172+00
923	18	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.638436+00	2026-10-12 12:53:02.638436+00
924	18	\N	\N	bridge_host	mac_address	E4:AA:E4:CE:51:AC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:53:02.731733+00	2026-10-12 12:53:02.731733+00
925	19	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d12h53m56s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.601648+00	2026-10-12 12:58:01.601648+00
926	19	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h23m50s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.604737+00	2026-10-12 12:58:01.604737+00
928	19	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h23m14s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.609437+00	2026-10-12 12:58:01.609437+00
929	19	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h49m30s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.611445+00	2026-10-12 12:58:01.611445+00
932	19	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "13h56m51s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.617851+00	2026-10-12 12:58:01.617851+00
933	19	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "13h56m30s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.620473+00	2026-10-12 12:58:01.620473+00
934	19	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "13h56m29s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.622524+00	2026-10-12 12:58:01.622524+00
935	19	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "13h56m29s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.624828+00	2026-10-12 12:58:01.624828+00
936	19	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "13h56m24s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.626882+00	2026-10-12 12:58:01.626882+00
937	19	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "13h56m21s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.629179+00	2026-10-12 12:58:01.629179+00
938	19	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h54m22s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.631243+00	2026-10-12 12:58:01.631243+00
939	19	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h35m43s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.633427+00	2026-10-12 12:58:01.633427+00
940	19	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h47m28s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.635419+00	2026-10-12 12:58:01.635419+00
993	20	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.530643+00	2026-10-12 13:03:02.530643+00
931	19	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h56m55s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.615895+00	2026-10-12 12:58:01.615895+00
930	19	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "13h56m58s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.613486+00	2026-10-12 12:58:01.613486+00
941	19	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "9h51m19s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.637398+00	2026-10-12 12:58:01.637398+00
942	19	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "29m15s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.640804+00	2026-10-12 12:58:01.640804+00
943	19	\N	\N	bridge_host	mac_address	12:24:C3:C6:78:2B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:58:01.668814+00	2026-10-12 12:58:01.668814+00
944	19	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:58:01.675774+00	2026-10-12 12:58:01.675774+00
945	19	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:58:01.678584+00	2026-10-12 12:58:01.678584+00
946	19	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:58:01.769011+00	2026-10-12 12:58:01.769011+00
947	19	\N	\N	bridge_host	mac_address	80:35:C1:E5:60:FC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:58:01.835115+00	2026-10-12 12:58:01.835115+00
948	19	\N	\N	bridge_host	mac_address	EE:5B:19:B2:22:EC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 12:58:02.035776+00	2026-10-12 12:58:02.035776+00
949	20	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d12h58m56s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.619038+00	2026-10-12 13:03:01.619038+00
950	20	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h28m50s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.622295+00	2026-10-12 13:03:01.622295+00
952	20	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h28m14s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.626422+00	2026-10-12 13:03:01.626422+00
953	20	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h54m30s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.628367+00	2026-10-12 13:03:01.628367+00
956	20	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h1m51s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.634322+00	2026-10-12 13:03:01.634322+00
957	20	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h1m30s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.63609+00	2026-10-12 13:03:01.63609+00
958	20	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h1m29s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.638225+00	2026-10-12 13:03:01.638225+00
959	20	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h1m29s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.640039+00	2026-10-12 13:03:01.640039+00
960	20	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h1m24s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.641778+00	2026-10-12 13:03:01.641778+00
961	20	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h1m21s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.643541+00	2026-10-12 13:03:01.643541+00
962	20	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "11h59m22s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.64536+00	2026-10-12 13:03:01.64536+00
963	20	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h40m43s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.64716+00	2026-10-12 13:03:01.64716+00
964	20	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h52m28s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.649099+00	2026-10-12 13:03:01.649099+00
955	20	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h1m55s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.632399+00	2026-10-12 13:03:01.632399+00
954	20	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h1m58s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.630278+00	2026-10-12 13:03:01.630278+00
965	20	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "9h56m19s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.65104+00	2026-10-12 13:03:01.65104+00
966	20	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "34m15s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.653068+00	2026-10-12 13:03:01.653068+00
967	20	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.655334+00	2026-10-12 13:03:01.655334+00
968	20	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.657297+00	2026-10-12 13:03:01.657297+00
969	20	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.659175+00	2026-10-12 13:03:01.659175+00
970	20	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.661145+00	2026-10-12 13:03:01.661145+00
971	20	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.663121+00	2026-10-12 13:03:01.663121+00
972	20	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.665671+00	2026-10-12 13:03:01.665671+00
973	20	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.667592+00	2026-10-12 13:03:01.667592+00
974	20	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.732542+00	2026-10-12 13:03:01.732542+00
975	20	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.735077+00	2026-10-12 13:03:01.735077+00
976	20	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.737152+00	2026-10-12 13:03:01.737152+00
977	20	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.83223+00	2026-10-12 13:03:01.83223+00
978	20	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.834585+00	2026-10-12 13:03:01.834585+00
979	20	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:01.836689+00	2026-10-12 13:03:01.836689+00
980	20	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.031902+00	2026-10-12 13:03:02.031902+00
981	20	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.034069+00	2026-10-12 13:03:02.034069+00
982	20	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.036109+00	2026-10-12 13:03:02.036109+00
983	20	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.038164+00	2026-10-12 13:03:02.038164+00
984	20	\N	\N	bridge_host	mac_address	4E:A6:D3:20:14:AF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.040182+00	2026-10-12 13:03:02.040182+00
985	20	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.13347+00	2026-10-12 13:03:02.13347+00
986	20	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.135723+00	2026-10-12 13:03:02.135723+00
987	20	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.137889+00	2026-10-12 13:03:02.137889+00
988	20	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.43263+00	2026-10-12 13:03:02.43263+00
989	20	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.43503+00	2026-10-12 13:03:02.43503+00
990	20	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.43766+00	2026-10-12 13:03:02.43766+00
991	20	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.43968+00	2026-10-12 13:03:02.43968+00
992	20	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.442146+00	2026-10-12 13:03:02.442146+00
994	20	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.533692+00	2026-10-12 13:03:02.533692+00
995	20	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.632037+00	2026-10-12 13:03:02.632037+00
996	20	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.634388+00	2026-10-12 13:03:02.634388+00
997	20	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.637463+00	2026-10-12 13:03:02.637463+00
998	20	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.7317+00	2026-10-12 13:03:02.7317+00
999	20	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.734024+00	2026-10-12 13:03:02.734024+00
1000	20	\N	\N	bridge_host	mac_address	C6:E3:2F:EA:C0:C5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.736093+00	2026-10-12 13:03:02.736093+00
1001	20	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.738165+00	2026-10-12 13:03:02.738165+00
1002	20	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.830625+00	2026-10-12 13:03:02.830625+00
1003	20	\N	\N	bridge_host	mac_address	D2:9D:98:57:C8:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.833418+00	2026-10-12 13:03:02.833418+00
1004	20	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.835618+00	2026-10-12 13:03:02.835618+00
1005	20	\N	\N	bridge_host	mac_address	F2:F1:B0:07:F7:EE	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.83799+00	2026-10-12 13:03:02.83799+00
1006	20	\N	\N	bridge_host	mac_address	F6:64:F2:53:11:C1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:03:02.839831+00	2026-10-12 13:03:02.839831+00
1007	21	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h3m56s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.680029+00	2026-10-12 13:08:01.680029+00
1008	21	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h33m50s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.683314+00	2026-10-12 13:08:01.683314+00
1010	21	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h33m14s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.687728+00	2026-10-12 13:08:01.687728+00
1011	21	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "15h59m30s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.68985+00	2026-10-12 13:08:01.68985+00
1014	21	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h6m51s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.695914+00	2026-10-12 13:08:01.695914+00
1015	21	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h6m30s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.69773+00	2026-10-12 13:08:01.69773+00
1016	21	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h6m29s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.699423+00	2026-10-12 13:08:01.699423+00
1017	21	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h6m29s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.701262+00	2026-10-12 13:08:01.701262+00
1018	21	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h6m24s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.703311+00	2026-10-12 13:08:01.703311+00
1070	22	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.762966+00	2026-10-12 13:13:02.762966+00
1013	21	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h6m55s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.693875+00	2026-10-12 13:08:01.693875+00
1012	21	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h6m58s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.691807+00	2026-10-12 13:08:01.691807+00
1019	21	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h6m21s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.705809+00	2026-10-12 13:08:01.705809+00
1020	21	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h4m22s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.73287+00	2026-10-12 13:08:01.73287+00
1021	21	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h45m43s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.934227+00	2026-10-12 13:08:01.934227+00
1022	21	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "10h57m28s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.937484+00	2026-10-12 13:08:01.937484+00
1023	21	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h1m19s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.970131+00	2026-10-12 13:08:01.970131+00
1024	21	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "1m59s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:02.032745+00	2026-10-12 13:08:02.032745+00
1025	21	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:08:02.236137+00	2026-10-12 13:08:02.236137+00
1026	21	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:08:02.332557+00	2026-10-12 13:08:02.332557+00
1027	21	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:08:02.433414+00	2026-10-12 13:08:02.433414+00
1028	21	\N	\N	bridge_host	mac_address	DA:F5:A4:7E:E1:93	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:08:02.735872+00	2026-10-12 13:08:02.735872+00
1029	21	\N	\N	bridge_host	mac_address	EE:5B:19:B2:22:EC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:08:02.832437+00	2026-10-12 13:08:02.832437+00
1030	22	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h8m56s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.735984+00	2026-10-12 13:13:01.735984+00
1031	22	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h38m50s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.772706+00	2026-10-12 13:13:01.772706+00
1033	22	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h38m14s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.778991+00	2026-10-12 13:13:01.778991+00
1034	22	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h4m30s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.781009+00	2026-10-12 13:13:01.781009+00
1037	22	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h11m51s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.931008+00	2026-10-12 13:13:01.931008+00
1038	22	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h11m30s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.940014+00	2026-10-12 13:13:01.940014+00
1039	22	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h11m29s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.946969+00	2026-10-12 13:13:01.946969+00
1040	22	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h11m29s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:02.032679+00	2026-10-12 13:13:02.032679+00
1041	22	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h11m24s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:02.131003+00	2026-10-12 13:13:02.131003+00
1042	22	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h11m21s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:02.134891+00	2026-10-12 13:13:02.134891+00
1036	22	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h11m55s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.87297+00	2026-10-12 13:13:01.87297+00
1035	22	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h11m58s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.834094+00	2026-10-12 13:13:01.834094+00
1043	22	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h9m22s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:02.136928+00	2026-10-12 13:13:02.136928+00
1044	22	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h50m43s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:02.250926+00	2026-10-12 13:13:02.250926+00
1045	22	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h2m28s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:02.258011+00	2026-10-12 13:13:02.258011+00
1046	22	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h6m19s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:02.263003+00	2026-10-12 13:13:02.263003+00
1047	22	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "1m52s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:02.267528+00	2026-10-12 13:13:02.267528+00
1048	22	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.332087+00	2026-10-12 13:13:02.332087+00
1049	22	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.341038+00	2026-10-12 13:13:02.341038+00
1050	22	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.430635+00	2026-10-12 13:13:02.430635+00
1051	22	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.437685+00	2026-10-12 13:13:02.437685+00
1052	22	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.533003+00	2026-10-12 13:13:02.533003+00
1053	22	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.538186+00	2026-10-12 13:13:02.538186+00
1054	22	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.540831+00	2026-10-12 13:13:02.540831+00
1055	22	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.548622+00	2026-10-12 13:13:02.548622+00
1056	22	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.552545+00	2026-10-12 13:13:02.552545+00
1057	22	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.635095+00	2026-10-12 13:13:02.635095+00
1058	22	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.638017+00	2026-10-12 13:13:02.638017+00
1059	22	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.640972+00	2026-10-12 13:13:02.640972+00
1060	22	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.643972+00	2026-10-12 13:13:02.643972+00
1061	22	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.735966+00	2026-10-12 13:13:02.735966+00
1062	22	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.738964+00	2026-10-12 13:13:02.738964+00
1063	22	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.741671+00	2026-10-12 13:13:02.741671+00
1064	22	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.744964+00	2026-10-12 13:13:02.744964+00
1065	22	\N	\N	bridge_host	mac_address	4E:A6:D3:20:14:AF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.747962+00	2026-10-12 13:13:02.747962+00
1066	22	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.750965+00	2026-10-12 13:13:02.750965+00
1067	22	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.753964+00	2026-10-12 13:13:02.753964+00
1068	22	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.756651+00	2026-10-12 13:13:02.756651+00
1069	22	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.759966+00	2026-10-12 13:13:02.759966+00
1071	22	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.765998+00	2026-10-12 13:13:02.765998+00
1072	22	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.768771+00	2026-10-12 13:13:02.768771+00
1073	22	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.773014+00	2026-10-12 13:13:02.773014+00
1074	22	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.775961+00	2026-10-12 13:13:02.775961+00
1075	22	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.832061+00	2026-10-12 13:13:02.832061+00
1076	22	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.835965+00	2026-10-12 13:13:02.835965+00
1077	22	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.838865+00	2026-10-12 13:13:02.838865+00
1078	22	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.842963+00	2026-10-12 13:13:02.842963+00
1079	22	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.845762+00	2026-10-12 13:13:02.845762+00
1080	22	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.848786+00	2026-10-12 13:13:02.848786+00
1081	22	\N	\N	bridge_host	mac_address	C6:E3:2F:EA:C0:C5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.851964+00	2026-10-12 13:13:02.851964+00
1082	22	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.854997+00	2026-10-12 13:13:02.854997+00
1083	22	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:13:02.857741+00	2026-10-12 13:13:02.857741+00
1084	23	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h11m53s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.921882+00	2026-10-12 13:15:58.921882+00
1085	23	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h41m47s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.924843+00	2026-10-12 13:15:58.924843+00
1087	23	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h41m11s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.929755+00	2026-10-12 13:15:58.929755+00
1088	23	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h7m27s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.932217+00	2026-10-12 13:15:58.932217+00
1091	23	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h14m48s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.939438+00	2026-10-12 13:15:58.939438+00
1092	23	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h14m27s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.941853+00	2026-10-12 13:15:58.941853+00
1093	23	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h14m26s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.944247+00	2026-10-12 13:15:58.944247+00
1094	23	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h14m26s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.946706+00	2026-10-12 13:15:58.946706+00
1095	23	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h14m21s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.949064+00	2026-10-12 13:15:58.949064+00
1171	25	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.635491+00	2026-10-12 13:22:57.635491+00
1090	23	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h14m52s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.937077+00	2026-10-12 13:15:58.937077+00
1089	23	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h14m55s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.934698+00	2026-10-12 13:15:58.934698+00
1096	23	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h14m18s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.951623+00	2026-10-12 13:15:58.951623+00
1097	23	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h12m19s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.953947+00	2026-10-12 13:15:58.953947+00
1098	23	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h53m40s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.956238+00	2026-10-12 13:15:58.956238+00
1099	23	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h5m25s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.958459+00	2026-10-12 13:15:58.958459+00
1100	23	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h9m16s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.960765+00	2026-10-12 13:15:58.960765+00
1101	23	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "4m49s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.962921+00	2026-10-12 13:15:58.962921+00
1102	23	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:15:59.052851+00	2026-10-12 13:15:59.052851+00
1103	24	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h16m50s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.758786+00	2026-10-12 13:20:55.758786+00
1104	24	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h46m44s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.762626+00	2026-10-12 13:20:55.762626+00
1106	24	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h46m8s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.767207+00	2026-10-12 13:20:55.767207+00
1107	24	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h12m24s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.769639+00	2026-10-12 13:20:55.769639+00
1110	24	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h19m45s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.777261+00	2026-10-12 13:20:55.777261+00
1111	24	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h19m24s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.779571+00	2026-10-12 13:20:55.779571+00
1112	24	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h19m23s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.781899+00	2026-10-12 13:20:55.781899+00
1113	24	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h19m23s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.78412+00	2026-10-12 13:20:55.78412+00
1114	24	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h19m18s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.786646+00	2026-10-12 13:20:55.786646+00
1115	24	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h19m15s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.789004+00	2026-10-12 13:20:55.789004+00
1116	24	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h17m16s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.791142+00	2026-10-12 13:20:55.791142+00
1117	24	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "11h58m37s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.79336+00	2026-10-12 13:20:55.79336+00
1118	24	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h10m22s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.795566+00	2026-10-12 13:20:55.795566+00
1109	24	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h19m49s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.775004+00	2026-10-12 13:20:55.775004+00
1108	24	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h19m52s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.771929+00	2026-10-12 13:20:55.771929+00
1119	24	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h14m13s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.797915+00	2026-10-12 13:20:55.797915+00
1120	24	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "9m46s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.832922+00	2026-10-12 13:20:55.832922+00
1121	24	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "2m36s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.835192+00	2026-10-12 13:20:55.835192+00
1122	24	\N	\N	bridge_host	mac_address	1C:CC:D6:44:A9:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.842275+00	2026-10-12 13:20:55.842275+00
1123	24	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.844785+00	2026-10-12 13:20:55.844785+00
1124	24	\N	\N	bridge_host	mac_address	3A:09:AC:B2:06:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.849638+00	2026-10-12 13:20:55.849638+00
1125	24	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.855586+00	2026-10-12 13:20:55.855586+00
1126	24	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.858142+00	2026-10-12 13:20:55.858142+00
1127	24	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.934321+00	2026-10-12 13:20:55.934321+00
1128	24	\N	\N	bridge_host	mac_address	80:35:C1:E5:60:FC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.939317+00	2026-10-12 13:20:55.939317+00
1129	24	\N	\N	bridge_host	mac_address	A0:7F:09:03:B8:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.945105+00	2026-10-12 13:20:55.945105+00
1130	24	\N	\N	bridge_host	mac_address	DA:F5:A4:7E:E1:93	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.959839+00	2026-10-12 13:20:55.959839+00
1131	24	\N	\N	bridge_host	mac_address	EE:5B:19:B2:22:EC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:20:55.963693+00	2026-10-12 13:20:55.963693+00
1132	25	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h18m52s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.419974+00	2026-10-12 13:22:57.419974+00
1133	25	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h48m46s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.424969+00	2026-10-12 13:22:57.424969+00
1135	25	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h48m10s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.431855+00	2026-10-12 13:22:57.431855+00
1136	25	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h14m26s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.43502+00	2026-10-12 13:22:57.43502+00
1139	25	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h21m47s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.442381+00	2026-10-12 13:22:57.442381+00
1140	25	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h21m26s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.444612+00	2026-10-12 13:22:57.444612+00
1141	25	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h21m25s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.446918+00	2026-10-12 13:22:57.446918+00
1142	25	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h21m25s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.448916+00	2026-10-12 13:22:57.448916+00
1143	25	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h21m20s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.451041+00	2026-10-12 13:22:57.451041+00
1138	25	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h21m51s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.43966+00	2026-10-12 13:22:57.43966+00
1137	25	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h21m54s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.437545+00	2026-10-12 13:22:57.437545+00
1144	25	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h21m17s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.454636+00	2026-10-12 13:22:57.454636+00
1145	25	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h19m18s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.456849+00	2026-10-12 13:22:57.456849+00
1146	25	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h39s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.458851+00	2026-10-12 13:22:57.458851+00
1147	25	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h12m24s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.460815+00	2026-10-12 13:22:57.460815+00
1148	25	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h16m15s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.462788+00	2026-10-12 13:22:57.462788+00
1149	25	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "11m48s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.464683+00	2026-10-12 13:22:57.464683+00
1150	25	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "4m38s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.466509+00	2026-10-12 13:22:57.466509+00
1151	25	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.468856+00	2026-10-12 13:22:57.468856+00
1152	25	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.471036+00	2026-10-12 13:22:57.471036+00
1153	25	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.473034+00	2026-10-12 13:22:57.473034+00
1154	25	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.475049+00	2026-10-12 13:22:57.475049+00
1155	25	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.476901+00	2026-10-12 13:22:57.476901+00
1156	25	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.530616+00	2026-10-12 13:22:57.530616+00
1157	25	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.534442+00	2026-10-12 13:22:57.534442+00
1158	25	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.536708+00	2026-10-12 13:22:57.536708+00
1159	25	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.5387+00	2026-10-12 13:22:57.5387+00
1160	25	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.540804+00	2026-10-12 13:22:57.540804+00
1161	25	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.543649+00	2026-10-12 13:22:57.543649+00
1162	25	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.545905+00	2026-10-12 13:22:57.545905+00
1163	25	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.54802+00	2026-10-12 13:22:57.54802+00
1164	25	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.551358+00	2026-10-12 13:22:57.551358+00
1165	25	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.553654+00	2026-10-12 13:22:57.553654+00
1166	25	\N	\N	bridge_host	mac_address	4E:A6:D3:20:14:AF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.555901+00	2026-10-12 13:22:57.555901+00
1167	25	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.558067+00	2026-10-12 13:22:57.558067+00
1168	25	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.560132+00	2026-10-12 13:22:57.560132+00
1169	25	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.562185+00	2026-10-12 13:22:57.562185+00
1170	25	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.632954+00	2026-10-12 13:22:57.632954+00
1172	25	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.637758+00	2026-10-12 13:22:57.637758+00
1173	25	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.639909+00	2026-10-12 13:22:57.639909+00
1174	25	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.641996+00	2026-10-12 13:22:57.641996+00
1175	25	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.644837+00	2026-10-12 13:22:57.644837+00
1176	25	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.647284+00	2026-10-12 13:22:57.647284+00
1177	25	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.649444+00	2026-10-12 13:22:57.649444+00
1178	25	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.651552+00	2026-10-12 13:22:57.651552+00
1179	25	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.653709+00	2026-10-12 13:22:57.653709+00
1180	25	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.65599+00	2026-10-12 13:22:57.65599+00
1181	25	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.658209+00	2026-10-12 13:22:57.658209+00
1182	25	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.660993+00	2026-10-12 13:22:57.660993+00
1183	25	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:22:57.663186+00	2026-10-12 13:22:57.663186+00
1184	26	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h23m51s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.664447+00	2026-10-12 13:27:56.664447+00
1185	26	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h53m45s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.667312+00	2026-10-12 13:27:56.667312+00
1187	26	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h53m9s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.671691+00	2026-10-12 13:27:56.671691+00
1188	26	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h19m25s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.673894+00	2026-10-12 13:27:56.673894+00
1191	26	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h26m46s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.68028+00	2026-10-12 13:27:56.68028+00
1192	26	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h26m25s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.682285+00	2026-10-12 13:27:56.682285+00
1193	26	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h26m24s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.684186+00	2026-10-12 13:27:56.684186+00
1194	26	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h26m24s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.686141+00	2026-10-12 13:27:56.686141+00
1195	26	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h26m19s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.688122+00	2026-10-12 13:27:56.688122+00
1196	26	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h26m16s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.690145+00	2026-10-12 13:27:56.690145+00
1190	26	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h26m50s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.678169+00	2026-10-12 13:27:56.678169+00
1189	26	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h26m53s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.676133+00	2026-10-12 13:27:56.676133+00
1197	26	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h24m17s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.692085+00	2026-10-12 13:27:56.692085+00
1198	26	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h5m38s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.694216+00	2026-10-12 13:27:56.694216+00
1199	26	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h17m23s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.696434+00	2026-10-12 13:27:56.696434+00
1200	26	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h21m14s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.698502+00	2026-10-12 13:27:56.698502+00
1201	26	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "16m47s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.700529+00	2026-10-12 13:27:56.700529+00
1202	26	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "9m37s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.730618+00	2026-10-12 13:27:56.730618+00
1203	26	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:27:56.744422+00	2026-10-12 13:27:56.744422+00
1204	26	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:27:56.747025+00	2026-10-12 13:27:56.747025+00
1205	26	\N	\N	bridge_host	mac_address	C6:E3:2F:EA:C0:C5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:27:56.838744+00	2026-10-12 13:27:56.838744+00
1206	26	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:27:56.840847+00	2026-10-12 13:27:56.840847+00
1207	27	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h28m51s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.951755+00	2026-10-12 13:32:56.951755+00
1208	27	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d3h58m45s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.954605+00	2026-10-12 13:32:56.954605+00
1210	27	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d3h58m9s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.95868+00	2026-10-12 13:32:56.95868+00
1211	27	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h24m25s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.960896+00	2026-10-12 13:32:56.960896+00
1214	27	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h31m46s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.966634+00	2026-10-12 13:32:56.966634+00
1215	27	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h31m25s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.968569+00	2026-10-12 13:32:56.968569+00
1216	27	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h31m24s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.970473+00	2026-10-12 13:32:56.970473+00
1217	27	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h31m24s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.972532+00	2026-10-12 13:32:56.972532+00
1218	27	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h31m19s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.974461+00	2026-10-12 13:32:56.974461+00
1219	27	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h31m16s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.976475+00	2026-10-12 13:32:56.976475+00
1220	27	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h29m17s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.978442+00	2026-10-12 13:32:56.978442+00
1213	27	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h31m50s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.964712+00	2026-10-12 13:32:56.964712+00
1212	27	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h31m53s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.962789+00	2026-10-12 13:32:56.962789+00
1221	27	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h10m38s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.98053+00	2026-10-12 13:32:56.98053+00
1222	27	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h22m23s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.982587+00	2026-10-12 13:32:56.982587+00
1223	27	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h26m14s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.98464+00	2026-10-12 13:32:56.98464+00
1224	27	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "14m37s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.986594+00	2026-10-12 13:32:56.986594+00
1225	27	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "1m47s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:57.030612+00	2026-10-12 13:32:57.030612+00
1226	27	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.033499+00	2026-10-12 13:32:57.033499+00
1227	27	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.035737+00	2026-10-12 13:32:57.035737+00
1228	27	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.037609+00	2026-10-12 13:32:57.037609+00
1229	27	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.04013+00	2026-10-12 13:32:57.04013+00
1230	27	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.042224+00	2026-10-12 13:32:57.042224+00
1231	27	\N	\N	bridge_host	mac_address	14:47:2D:3D:5D:CF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.04427+00	2026-10-12 13:32:57.04427+00
1232	27	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.046331+00	2026-10-12 13:32:57.046331+00
1233	27	\N	\N	bridge_host	mac_address	1C:CC:D6:44:A9:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.048318+00	2026-10-12 13:32:57.048318+00
1234	27	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.050607+00	2026-10-12 13:32:57.050607+00
1235	27	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.052907+00	2026-10-12 13:32:57.052907+00
1236	27	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.054994+00	2026-10-12 13:32:57.054994+00
1237	27	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.056795+00	2026-10-12 13:32:57.056795+00
1238	27	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.058627+00	2026-10-12 13:32:57.058627+00
1239	27	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.060454+00	2026-10-12 13:32:57.060454+00
1240	27	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.062404+00	2026-10-12 13:32:57.062404+00
1241	27	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.064399+00	2026-10-12 13:32:57.064399+00
1242	27	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.066233+00	2026-10-12 13:32:57.066233+00
1243	27	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.068334+00	2026-10-12 13:32:57.068334+00
1244	27	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.132452+00	2026-10-12 13:32:57.132452+00
1245	27	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.134955+00	2026-10-12 13:32:57.134955+00
1246	27	\N	\N	bridge_host	mac_address	4E:A6:D3:20:14:AF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.137082+00	2026-10-12 13:32:57.137082+00
1247	27	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.139439+00	2026-10-12 13:32:57.139439+00
1248	27	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.142872+00	2026-10-12 13:32:57.142872+00
1249	27	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.144864+00	2026-10-12 13:32:57.144864+00
1250	27	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.146825+00	2026-10-12 13:32:57.146825+00
1251	27	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.148723+00	2026-10-12 13:32:57.148723+00
1252	27	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.150601+00	2026-10-12 13:32:57.150601+00
1253	27	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.152613+00	2026-10-12 13:32:57.152613+00
1254	27	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.154509+00	2026-10-12 13:32:57.154509+00
1255	27	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.156299+00	2026-10-12 13:32:57.156299+00
1256	27	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.158418+00	2026-10-12 13:32:57.158418+00
1257	27	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.160424+00	2026-10-12 13:32:57.160424+00
1258	27	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.16253+00	2026-10-12 13:32:57.16253+00
1259	27	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.166259+00	2026-10-12 13:32:57.166259+00
1260	27	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.232621+00	2026-10-12 13:32:57.232621+00
1261	27	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.235063+00	2026-10-12 13:32:57.235063+00
1262	27	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.239388+00	2026-10-12 13:32:57.239388+00
1263	27	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.24156+00	2026-10-12 13:32:57.24156+00
1264	27	\N	\N	bridge_host	mac_address	F2:F1:B0:07:F7:EE	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:32:57.24395+00	2026-10-12 13:32:57.24395+00
1265	28	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h33m52s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.612+00	2026-10-12 13:37:57.612+00
1266	28	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d4h3m46s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.615565+00	2026-10-12 13:37:57.615565+00
1268	28	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d4h3m10s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.633875+00	2026-10-12 13:37:57.633875+00
1269	28	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h29m26s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.636129+00	2026-10-12 13:37:57.636129+00
1272	28	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h36m47s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.641898+00	2026-10-12 13:37:57.641898+00
1273	28	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h36m26s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.643729+00	2026-10-12 13:37:57.643729+00
1271	28	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h36m51s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.640087+00	2026-10-12 13:37:57.640087+00
1270	28	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h36m54s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.63813+00	2026-10-12 13:37:57.63813+00
1274	28	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h36m25s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.645537+00	2026-10-12 13:37:57.645537+00
1275	28	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h36m25s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.67002+00	2026-10-12 13:37:57.67002+00
1276	28	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h36m20s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.671803+00	2026-10-12 13:37:57.671803+00
1277	28	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h36m17s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.673707+00	2026-10-12 13:37:57.673707+00
1278	28	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h34m18s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.675514+00	2026-10-12 13:37:57.675514+00
1279	28	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h15m39s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.67752+00	2026-10-12 13:37:57.67752+00
1280	28	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h27m24s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.679421+00	2026-10-12 13:37:57.679421+00
1281	28	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h31m15s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.681269+00	2026-10-12 13:37:57.681269+00
1282	28	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "19m38s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.683186+00	2026-10-12 13:37:57.683186+00
1283	28	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "6m48s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.68861+00	2026-10-12 13:37:57.68861+00
1284	28	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:37:57.742862+00	2026-10-12 13:37:57.742862+00
1285	28	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:37:57.745175+00	2026-10-12 13:37:57.745175+00
1286	28	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:37:57.749604+00	2026-10-12 13:37:57.749604+00
1287	28	\N	\N	bridge_host	mac_address	A0:7F:09:03:B8:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:37:57.754412+00	2026-10-12 13:37:57.754412+00
1288	28	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:37:57.835775+00	2026-10-12 13:37:57.835775+00
1289	28	\N	\N	bridge_host	mac_address	F6:BF:25:88:02:97	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:37:57.83936+00	2026-10-12 13:37:57.83936+00
1290	29	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h36m25s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.939008+00	2026-10-12 13:40:30.939008+00
1291	29	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d4h6m19s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.942446+00	2026-10-12 13:40:30.942446+00
1293	29	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d4h5m43s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.947101+00	2026-10-12 13:40:30.947101+00
1294	29	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h31m59s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.949324+00	2026-10-12 13:40:30.949324+00
1297	29	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h39m20s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.956157+00	2026-10-12 13:40:30.956157+00
1296	29	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h39m24s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.953999+00	2026-10-12 13:40:30.953999+00
1295	29	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h39m27s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.951607+00	2026-10-12 13:40:30.951607+00
1298	29	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h38m59s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.958519+00	2026-10-12 13:40:30.958519+00
1299	29	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h38m58s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.960757+00	2026-10-12 13:40:30.960757+00
1300	29	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h38m58s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.962962+00	2026-10-12 13:40:30.962962+00
1301	29	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h38m53s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.965065+00	2026-10-12 13:40:30.965065+00
1302	29	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h38m50s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.967235+00	2026-10-12 13:40:30.967235+00
1303	29	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h36m51s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.9693+00	2026-10-12 13:40:30.9693+00
1304	29	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h18m12s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:31.033688+00	2026-10-12 13:40:31.033688+00
1305	29	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h29m57s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:31.038265+00	2026-10-12 13:40:31.038265+00
1306	29	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h33m48s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:31.040604+00	2026-10-12 13:40:31.040604+00
1307	29	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "22m11s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:31.043126+00	2026-10-12 13:40:31.043126+00
1308	29	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "9m21s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:31.045212+00	2026-10-12 13:40:31.045212+00
1309	30	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h41m22s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.649475+00	2026-10-12 13:45:27.649475+00
1310	30	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d4h11m16s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.652784+00	2026-10-12 13:45:27.652784+00
1312	30	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d4h10m40s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.657356+00	2026-10-12 13:45:27.657356+00
1313	30	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h36m56s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.659516+00	2026-10-12 13:45:27.659516+00
1316	30	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h44m17s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.665899+00	2026-10-12 13:45:27.665899+00
1317	30	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h43m56s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.667883+00	2026-10-12 13:45:27.667883+00
1318	30	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h43m55s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.670005+00	2026-10-12 13:45:27.670005+00
1319	30	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h43m55s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.672051+00	2026-10-12 13:45:27.672051+00
1320	30	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h43m50s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.674014+00	2026-10-12 13:45:27.674014+00
1315	30	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h44m21s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.664001+00	2026-10-12 13:45:27.664001+00
1314	30	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h44m24s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.661775+00	2026-10-12 13:45:27.661775+00
1321	30	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h43m47s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.675882+00	2026-10-12 13:45:27.675882+00
1322	30	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h41m48s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.678038+00	2026-10-12 13:45:27.678038+00
1323	30	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h23m9s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.679924+00	2026-10-12 13:45:27.679924+00
1324	30	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h34m54s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.681865+00	2026-10-12 13:45:27.681865+00
1325	30	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h38m45s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.683593+00	2026-10-12 13:45:27.683593+00
1326	30	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "27m8s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.73205+00	2026-10-12 13:45:27.73205+00
1327	30	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "14m18s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.734179+00	2026-10-12 13:45:27.734179+00
1328	30	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.736544+00	2026-10-12 13:45:27.736544+00
1329	30	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.738585+00	2026-10-12 13:45:27.738585+00
1330	30	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.74081+00	2026-10-12 13:45:27.74081+00
1331	30	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.745134+00	2026-10-12 13:45:27.745134+00
1332	30	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.748871+00	2026-10-12 13:45:27.748871+00
1333	30	\N	\N	bridge_host	mac_address	14:47:2D:3D:5D:CF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.751251+00	2026-10-12 13:45:27.751251+00
1334	30	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.753441+00	2026-10-12 13:45:27.753441+00
1335	30	\N	\N	bridge_host	mac_address	1C:CC:D6:44:A9:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.755612+00	2026-10-12 13:45:27.755612+00
1336	30	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.757813+00	2026-10-12 13:45:27.757813+00
1337	30	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.760415+00	2026-10-12 13:45:27.760415+00
1338	30	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.762511+00	2026-10-12 13:45:27.762511+00
1339	30	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.764621+00	2026-10-12 13:45:27.764621+00
1340	30	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.766715+00	2026-10-12 13:45:27.766715+00
1341	30	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.832255+00	2026-10-12 13:45:27.832255+00
1342	30	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.834562+00	2026-10-12 13:45:27.834562+00
1343	30	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.83672+00	2026-10-12 13:45:27.83672+00
1344	30	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.838886+00	2026-10-12 13:45:27.838886+00
1345	30	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.841068+00	2026-10-12 13:45:27.841068+00
1346	30	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.843247+00	2026-10-12 13:45:27.843247+00
1347	30	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.845462+00	2026-10-12 13:45:27.845462+00
1348	30	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.849004+00	2026-10-12 13:45:27.849004+00
1349	30	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.851209+00	2026-10-12 13:45:27.851209+00
1350	30	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.853251+00	2026-10-12 13:45:27.853251+00
1351	30	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.856121+00	2026-10-12 13:45:27.856121+00
1352	30	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.858185+00	2026-10-12 13:45:27.858185+00
1353	30	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.860347+00	2026-10-12 13:45:27.860347+00
1354	30	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.862677+00	2026-10-12 13:45:27.862677+00
1355	30	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.864661+00	2026-10-12 13:45:27.864661+00
1356	30	\N	\N	bridge_host	mac_address	A2:4F:B2:04:06:F0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.932421+00	2026-10-12 13:45:27.932421+00
1357	30	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.934737+00	2026-10-12 13:45:27.934737+00
1358	30	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.936787+00	2026-10-12 13:45:27.936787+00
1359	30	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.939253+00	2026-10-12 13:45:27.939253+00
1360	30	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.941322+00	2026-10-12 13:45:27.941322+00
1361	30	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.943702+00	2026-10-12 13:45:27.943702+00
1362	30	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.94597+00	2026-10-12 13:45:27.94597+00
1363	30	\N	\N	bridge_host	mac_address	C6:B0:D6:B3:14:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.948183+00	2026-10-12 13:45:27.948183+00
1364	30	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.952343+00	2026-10-12 13:45:27.952343+00
1365	30	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:45:27.95537+00	2026-10-12 13:45:27.95537+00
1366	31	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h42m41s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.230983+00	2026-10-12 13:46:46.230983+00
1367	31	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d4h12m35s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.234213+00	2026-10-12 13:46:46.234213+00
1369	31	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d4h11m59s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.238815+00	2026-10-12 13:46:46.238815+00
1370	31	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h38m15s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.241073+00	2026-10-12 13:46:46.241073+00
1373	31	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h45m36s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.247383+00	2026-10-12 13:46:46.247383+00
1372	31	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h45m40s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.245413+00	2026-10-12 13:46:46.245413+00
1371	31	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h45m43s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.243305+00	2026-10-12 13:46:46.243305+00
1374	31	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h45m15s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.249479+00	2026-10-12 13:46:46.249479+00
1375	31	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h45m14s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.251674+00	2026-10-12 13:46:46.251674+00
1376	31	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h45m14s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.253804+00	2026-10-12 13:46:46.253804+00
1377	31	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h45m9s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.255844+00	2026-10-12 13:46:46.255844+00
1378	31	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h45m6s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.257867+00	2026-10-12 13:46:46.257867+00
1379	31	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h43m7s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.259866+00	2026-10-12 13:46:46.259866+00
1380	31	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h24m28s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.261927+00	2026-10-12 13:46:46.261927+00
1381	31	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h36m13s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.264144+00	2026-10-12 13:46:46.264144+00
1382	31	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h40m4s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.266182+00	2026-10-12 13:46:46.266182+00
1383	31	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "28m27s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.268223+00	2026-10-12 13:46:46.268223+00
1384	31	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "15m37s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.330628+00	2026-10-12 13:46:46.330628+00
1385	32	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h43m51s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.879357+00	2026-10-12 13:47:56.879357+00
1386	32	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d4h13m45s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.883217+00	2026-10-12 13:47:56.883217+00
1388	32	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d4h13m9s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.888476+00	2026-10-12 13:47:56.888476+00
1389	32	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h39m25s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.891103+00	2026-10-12 13:47:56.891103+00
1392	32	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h46m46s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.899085+00	2026-10-12 13:47:56.899085+00
1393	32	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h46m25s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.901758+00	2026-10-12 13:47:56.901758+00
1394	32	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h46m24s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.904201+00	2026-10-12 13:47:56.904201+00
1395	32	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h46m24s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.907131+00	2026-10-12 13:47:56.907131+00
1396	32	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h46m19s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.91039+00	2026-10-12 13:47:56.91039+00
1391	32	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h46m50s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.896593+00	2026-10-12 13:47:56.896593+00
1390	32	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h46m53s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.894166+00	2026-10-12 13:47:56.894166+00
1397	32	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h46m16s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.913198+00	2026-10-12 13:47:56.913198+00
1398	32	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h44m17s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.916234+00	2026-10-12 13:47:56.916234+00
1399	32	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h25m38s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.919304+00	2026-10-12 13:47:56.919304+00
1400	32	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h37m23s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.92175+00	2026-10-12 13:47:56.92175+00
1401	32	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h41m14s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.930594+00	2026-10-12 13:47:56.930594+00
1402	32	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "29m37s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.934262+00	2026-10-12 13:47:56.934262+00
1403	32	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "16m47s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.937168+00	2026-10-12 13:47:56.937168+00
1404	32	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:47:56.974146+00	2026-10-12 13:47:56.974146+00
1405	32	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:47:56.979369+00	2026-10-12 13:47:56.979369+00
1406	32	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:47:57.03762+00	2026-10-12 13:47:57.03762+00
1407	33	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h47m45s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.891388+00	2026-10-12 13:51:50.891388+00
1408	33	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d4h17m39s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.894186+00	2026-10-12 13:51:50.894186+00
1410	33	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d4h17m3s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.898585+00	2026-10-12 13:51:50.898585+00
1411	33	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h43m19s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.901045+00	2026-10-12 13:51:50.901045+00
1414	33	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h50m40s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.907415+00	2026-10-12 13:51:50.907415+00
1415	33	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h50m19s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.909545+00	2026-10-12 13:51:50.909545+00
1416	33	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h50m18s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.91148+00	2026-10-12 13:51:50.91148+00
1417	33	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h50m18s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.913628+00	2026-10-12 13:51:50.913628+00
1418	33	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h50m13s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.915802+00	2026-10-12 13:51:50.915802+00
1419	33	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h50m10s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.918288+00	2026-10-12 13:51:50.918288+00
1420	33	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h48m11s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.920642+00	2026-10-12 13:51:50.920642+00
1413	33	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h50m44s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.905359+00	2026-10-12 13:51:50.905359+00
1412	33	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h50m47s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.903149+00	2026-10-12 13:51:50.903149+00
1421	33	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h29m32s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.922927+00	2026-10-12 13:51:50.922927+00
1422	33	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h41m17s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.925005+00	2026-10-12 13:51:50.925005+00
1423	33	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h45m8s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.931172+00	2026-10-12 13:51:50.931172+00
1424	33	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "33m31s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.933121+00	2026-10-12 13:51:50.933121+00
1425	33	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "20m41s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.935011+00	2026-10-12 13:51:50.935011+00
1426	33	\N	\N	bridge_host	mac_address	4C:D7:C8:E8:0B:C9	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:51:50.972017+00	2026-10-12 13:51:50.972017+00
1427	34	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h51m14s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.649013+00	2026-10-12 13:55:19.649013+00
1428	34	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d4h21m8s", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.652328+00	2026-10-12 13:55:19.652328+00
1430	34	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d4h20m32s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.656746+00	2026-10-12 13:55:19.656746+00
1431	34	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h46m48s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.660967+00	2026-10-12 13:55:19.660967+00
1434	34	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h54m9s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.670877+00	2026-10-12 13:55:19.670877+00
1435	34	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h53m48s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.673887+00	2026-10-12 13:55:19.673887+00
1436	34	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h53m47s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.677001+00	2026-10-12 13:55:19.677001+00
1437	34	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h53m47s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.679155+00	2026-10-12 13:55:19.679155+00
1438	34	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h53m42s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.681502+00	2026-10-12 13:55:19.681502+00
1439	34	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h53m39s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.68356+00	2026-10-12 13:55:19.68356+00
1440	34	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h51m40s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.685679+00	2026-10-12 13:55:19.685679+00
1441	34	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h33m1s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.690873+00	2026-10-12 13:55:19.690873+00
1442	34	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h44m46s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.692967+00	2026-10-12 13:55:19.692967+00
1443	34	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h48m37s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.695978+00	2026-10-12 13:55:19.695978+00
1433	34	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h54m13s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.667776+00	2026-10-12 13:55:19.667776+00
1432	34	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h54m16s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.663908+00	2026-10-12 13:55:19.663908+00
1444	34	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "37m", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.698073+00	2026-10-12 13:55:19.698073+00
1445	34	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "24m10s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.733642+00	2026-10-12 13:55:19.733642+00
1446	34	\N	\N	bridge_host	mac_address	02:4D:5C:A3:34:2E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.7367+00	2026-10-12 13:55:19.7367+00
1447	34	\N	\N	bridge_host	mac_address	04:5E:A4:D5:48:45	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.739305+00	2026-10-12 13:55:19.739305+00
1448	34	\N	\N	bridge_host	mac_address	08:8A:F1:04:32:71	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.743629+00	2026-10-12 13:55:19.743629+00
1449	34	\N	\N	bridge_host	mac_address	08:8A:F1:10:D8:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.745837+00	2026-10-12 13:55:19.745837+00
1450	34	\N	\N	bridge_host	mac_address	08:8A:F1:9D:1B:46	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.747922+00	2026-10-12 13:55:19.747922+00
1451	34	\N	\N	bridge_host	mac_address	18:5B:B3:14:D7:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.750081+00	2026-10-12 13:55:19.750081+00
1452	34	\N	\N	bridge_host	mac_address	1C:CC:D6:44:A9:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.752216+00	2026-10-12 13:55:19.752216+00
1453	34	\N	\N	bridge_host	mac_address	30:07:5C:73:39:AB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.754403+00	2026-10-12 13:55:19.754403+00
1454	34	\N	\N	bridge_host	mac_address	30:07:5C:D9:61:EB	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.756689+00	2026-10-12 13:55:19.756689+00
1455	34	\N	\N	bridge_host	mac_address	30:07:5C:D9:6B:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.758875+00	2026-10-12 13:55:19.758875+00
1456	34	\N	\N	bridge_host	mac_address	30:68:93:10:4F:7A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.763068+00	2026-10-12 13:55:19.763068+00
1457	34	\N	\N	bridge_host	mac_address	34:86:DA:8C:44:CA	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.765311+00	2026-10-12 13:55:19.765311+00
1458	34	\N	\N	bridge_host	mac_address	3C:57:6C:99:37:37	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.833053+00	2026-10-12 13:55:19.833053+00
1459	34	\N	\N	bridge_host	mac_address	40:AE:30:F1:C4:B0	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.836051+00	2026-10-12 13:55:19.836051+00
1460	34	\N	\N	bridge_host	mac_address	40:ED:00:32:62:81	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.838372+00	2026-10-12 13:55:19.838372+00
1461	34	\N	\N	bridge_host	mac_address	4C:46:D1:B1:49:92	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.840992+00	2026-10-12 13:55:19.840992+00
1462	34	\N	\N	bridge_host	mac_address	4C:46:D1:B3:45:1E	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.843114+00	2026-10-12 13:55:19.843114+00
1463	34	\N	\N	bridge_host	mac_address	4C:46:D1:B8:6A:56	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.845207+00	2026-10-12 13:55:19.845207+00
1464	34	\N	\N	bridge_host	mac_address	50:0F:F5:68:B0:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.848752+00	2026-10-12 13:55:19.848752+00
1465	34	\N	\N	bridge_host	mac_address	62:96:31:54:C0:BF	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.850994+00	2026-10-12 13:55:19.850994+00
1466	34	\N	\N	bridge_host	mac_address	6C:00:6B:1E:A2:2F	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.853167+00	2026-10-12 13:55:19.853167+00
1467	34	\N	\N	bridge_host	mac_address	7C:F1:7E:88:7B:78	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.859377+00	2026-10-12 13:55:19.859377+00
1468	34	\N	\N	bridge_host	mac_address	80:AF:CA:70:B3:59	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.862108+00	2026-10-12 13:55:19.862108+00
1469	34	\N	\N	bridge_host	mac_address	80:F1:A8:5A:BE:35	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.864424+00	2026-10-12 13:55:19.864424+00
1470	34	\N	\N	bridge_host	mac_address	8C:90:2D:34:77:E1	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.867047+00	2026-10-12 13:55:19.867047+00
1471	34	\N	\N	bridge_host	mac_address	9E:D9:25:D6:C2:80	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.870005+00	2026-10-12 13:55:19.870005+00
1472	34	\N	\N	bridge_host	mac_address	B0:19:21:03:5A:38	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.873017+00	2026-10-12 13:55:19.873017+00
1473	34	\N	\N	bridge_host	mac_address	B0:19:21:13:E3:9B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.876071+00	2026-10-12 13:55:19.876071+00
1474	34	\N	\N	bridge_host	mac_address	B0:19:21:62:E8:22	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.931003+00	2026-10-12 13:55:19.931003+00
1475	34	\N	\N	bridge_host	mac_address	BC:62:CE:0A:54:3C	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.934577+00	2026-10-12 13:55:19.934577+00
1476	34	\N	\N	bridge_host	mac_address	BC:E0:01:7C:CC:0B	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.93711+00	2026-10-12 13:55:19.93711+00
1477	34	\N	\N	bridge_host	mac_address	BC:E0:01:AF:F7:C7	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.939957+00	2026-10-12 13:55:19.939957+00
1478	34	\N	\N	bridge_host	mac_address	C6:B0:D6:B3:14:5A	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.944711+00	2026-10-12 13:55:19.944711+00
1479	34	\N	\N	bridge_host	mac_address	CC:2D:21:01:B5:67	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.947479+00	2026-10-12 13:55:19.947479+00
1480	34	\N	\N	bridge_host	mac_address	E0:09:BF:81:E9:D5	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.949623+00	2026-10-12 13:55:19.949623+00
1481	34	\N	\N	bridge_host	mac_address	EE:5B:19:B2:22:EC	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:55:19.951809+00	2026-10-12 13:55:19.951809+00
1482	35	\N	13	pppoe_session	pppoe_username	prodip1234	{"ip": "10.20.30.244", "uptime": "1d13h53m6s", "service": "pppoe", "username": "prodip1234", "routerMac": "BC:E0:01:AF:F7:C7"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.413969+00	2026-10-12 13:57:11.413969+00
1483	35	\N	33	pppoe_session	pppoe_username	10012	{"ip": "10.20.30.251", "uptime": "1d4h23m", "service": "pppoe", "username": "10012", "routerMac": "30:68:93:10:4F:7A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.418413+00	2026-10-12 13:57:11.418413+00
1485	35	\N	29	pppoe_session	pppoe_username	10007	{"ip": "10.20.30.246", "uptime": "1d4h22m24s", "service": "pppoe", "username": "10007", "routerMac": "30:07:5C:D9:61:EB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.424297+00	2026-10-12 13:57:11.424297+00
1486	35	\N	16	pppoe_session	pppoe_username	ratanchandra854	{"ip": "10.20.30.233", "uptime": "16h48m40s", "service": "pppoe", "username": "ratanchandra854", "routerMac": "30:07:5C:D9:6B:5A"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.428673+00	2026-10-12 13:57:11.428673+00
1489	35	\N	\N	pppoe_session	pppoe_username	pulok1234	{"ip": "10.20.30.248", "uptime": "14h56m1s", "service": "pppoe", "username": "pulok1234", "routerMac": "7C:F1:7E:88:7B:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.43878+00	2026-10-12 13:57:11.43878+00
1490	35	\N	25	pppoe_session	pppoe_username	10005	{"ip": "10.20.30.241", "uptime": "14h55m40s", "service": "pppoe", "username": "10005", "routerMac": "8C:90:2D:34:77:E1"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.441044+00	2026-10-12 13:57:11.441044+00
1491	35	\N	9	pppoe_session	pppoe_username	10004	{"ip": "10.20.30.254", "uptime": "14h55m39s", "service": "pppoe", "username": "10004", "routerMac": "08:8A:F1:04:32:71"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.443346+00	2026-10-12 13:57:11.443346+00
1492	35	\N	30	pppoe_session	pppoe_username	10008	{"ip": "10.20.30.237", "uptime": "14h55m39s", "service": "pppoe", "username": "10008", "routerMac": "08:8A:F1:10:D8:CA"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.445731+00	2026-10-12 13:57:11.445731+00
1493	35	\N	32	pppoe_session	pppoe_username	1011	{"ip": "10.20.30.247", "uptime": "14h55m34s", "service": "pppoe", "username": "1011", "routerMac": "BC:62:CE:0A:54:3C"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.448015+00	2026-10-12 13:57:11.448015+00
1494	35	\N	17	pppoe_session	pppoe_username	muslim1234	{"ip": "10.20.30.253", "uptime": "14h55m31s", "service": "pppoe", "username": "muslim1234", "routerMac": "B0:19:21:03:5A:38"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.450059+00	2026-10-12 13:57:11.450059+00
1495	35	\N	14	pppoe_session	pppoe_username	10009	{"ip": "10.20.30.252", "uptime": "12h53m32s", "service": "pppoe", "username": "10009", "routerMac": "40:AE:30:F1:C4:B0"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.45234+00	2026-10-12 13:57:11.45234+00
1496	35	\N	34	pppoe_session	pppoe_username	mithun1234	{"ip": "10.20.30.249", "uptime": "12h34m53s", "service": "pppoe", "username": "mithun1234", "routerMac": "80:AF:CA:70:B3:59"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.454982+00	2026-10-12 13:57:11.454982+00
1488	35	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "14h56m5s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.436207+00	2026-10-12 13:57:11.436207+00
1487	35	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "14h56m8s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.433072+00	2026-10-12 13:57:11.433072+00
1497	35	\N	31	pppoe_session	pppoe_username	1010	{"ip": "10.20.30.230", "uptime": "11h46m38s", "service": "pppoe", "username": "1010", "routerMac": "40:ED:00:32:62:81"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.45717+00	2026-10-12 13:57:11.45717+00
1498	35	\N	27	pppoe_session	pppoe_username	10002	{"ip": "10.20.30.235", "uptime": "10h50m29s", "service": "pppoe", "username": "10002", "routerMac": "CC:2D:21:01:B5:67"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.459473+00	2026-10-12 13:57:11.459473+00
1499	35	\N	10	pppoe_session	pppoe_username	shafikul404	{"ip": "10.20.30.229", "uptime": "38m52s", "service": "pppoe", "username": "shafikul404", "routerMac": "30:07:5C:73:39:AB"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.461616+00	2026-10-12 13:57:11.461616+00
1500	35	\N	8	pppoe_session	pppoe_username	10003	{"ip": "10.20.30.239", "uptime": "26m2s", "service": "pppoe", "username": "10003", "routerMac": "B0:19:21:13:E3:9B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.463746+00	2026-10-12 13:57:11.463746+00
1501	35	\N	\N	bridge_host	mac_address	4C:D7:C8:A1:C0:7D	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:57:11.53877+00	2026-10-12 13:57:11.53877+00
1502	35	\N	\N	bridge_host	mac_address	6C:68:A4:A5:AA:20	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:57:11.54392+00	2026-10-12 13:57:11.54392+00
1503	35	\N	\N	bridge_host	mac_address	C8:90:8A:70:C7:53	{"bridge": "Master_Lan", "vlanId": null, "dynamic": true, "interface": "ether10"}	unmatched	\N	{"rule": "no_customer_identity_inferred", "source": "mikrotik_bridge_host"}	2026-10-12 13:57:11.553182+00	2026-10-12 13:57:11.553182+00
3	1	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d1h1m34s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:35:56.539774+00	2026-10-12 10:35:56.539774+00
63	2	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d1h11m31s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.762459+00	2026-10-12 10:45:53.762459+00
121	3	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d1h21m31s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:55:53.941207+00	2026-10-12 10:55:53.941207+00
181	4	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d1h25m41s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:00:03.091008+00	2026-10-12 11:00:03.091008+00
200	5	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d1h35m40s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:10:02.647689+00	2026-10-12 11:10:02.647689+00
257	6	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d1h45m40s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:20:02.725173+00	2026-10-12 11:20:02.725173+00
313	7	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d1h55m40s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.666442+00	2026-10-12 11:30:02.666442+00
370	8	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d1h57m23s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:31:45.253764+00	2026-10-12 11:31:45.253764+00
391	9	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d2h7m22s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.129968+00	2026-10-12 11:41:44.129968+00
454	10	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d2h17m22s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:51:44.193211+00	2026-10-12 11:51:44.193211+00
514	11	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d2h27m22s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:01:44.169781+00	2026-10-12 12:01:44.169781+00
576	12	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d2h29m34s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:03:56.826631+00	2026-10-12 12:03:56.826631+00
596	13	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d2h39m32s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.331407+00	2026-10-12 12:13:54.331407+00
655	14	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d2h49m32s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:23:54.39216+00	2026-10-12 12:23:54.39216+00
718	15	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d2h59m32s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:33:54.952544+00	2026-10-12 12:33:54.952544+00
781	16	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h9m32s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:43:54.610016+00	2026-10-12 12:43:54.610016+00
842	17	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h13m38s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:48:00.787032+00	2026-10-12 12:48:00.787032+00
868	18	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h18m39s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:53:01.592888+00	2026-10-12 12:53:01.592888+00
927	19	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h23m39s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:58:01.607177+00	2026-10-12 12:58:01.607177+00
951	20	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h28m39s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:03:01.624488+00	2026-10-12 13:03:01.624488+00
1009	21	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h33m39s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:08:01.685542+00	2026-10-12 13:08:01.685542+00
1032	22	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h38m39s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:13:01.775883+00	2026-10-12 13:13:01.775883+00
1086	23	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h41m36s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:15:58.927176+00	2026-10-12 13:15:58.927176+00
1105	24	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h46m33s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:20:55.765008+00	2026-10-12 13:20:55.765008+00
1134	25	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h48m35s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:22:57.428965+00	2026-10-12 13:22:57.428965+00
1186	26	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h53m34s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:27:56.669529+00	2026-10-12 13:27:56.669529+00
1209	27	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d3h58m34s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:32:56.956684+00	2026-10-12 13:32:56.956684+00
1267	28	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d4h3m35s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:37:57.631683+00	2026-10-12 13:37:57.631683+00
1292	29	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d4h6m8s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:40:30.944802+00	2026-10-12 13:40:30.944802+00
1311	30	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d4h11m5s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:45:27.654962+00	2026-10-12 13:45:27.654962+00
1368	31	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d4h12m24s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:46:46.236518+00	2026-10-12 13:46:46.236518+00
1387	32	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d4h13m34s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:47:56.885819+00	2026-10-12 13:47:56.885819+00
1409	33	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d4h17m28s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:51:50.896427+00	2026-10-12 13:51:50.896427+00
1429	34	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d4h20m57s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:55:19.654432+00	2026-10-12 13:55:19.654432+00
1484	35	\N	\N	pppoe_session	pppoe_username	mun1234	{"ip": "10.20.30.245", "uptime": "1d4h22m49s", "service": "pppoe", "username": "mun1234", "routerMac": "BC:E0:01:7C:CC:0B"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 13:57:11.421704+00	2026-10-12 13:57:11.421704+00
317	7	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "12h28m56s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:30:02.674146+00	2026-10-12 11:30:02.674146+00
395	9	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "12h40m38s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 11:41:44.141974+00	2026-10-12 11:41:44.141974+00
600	13	\N	\N	pppoe_session	pppoe_username	durjoy1234	{"ip": "10.20.30.231", "uptime": "13h12m48s", "service": "pppoe", "username": "durjoy1234", "routerMac": "50:0F:F5:68:B0:78"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 12:13:54.339008+00	2026-10-12 12:13:54.339008+00
66	2	\N	\N	pppoe_session	pppoe_username	ratanchandra1234	{"ip": "10.20.30.250", "uptime": "11h44m50s", "service": "pppoe", "username": "ratanchandra1234", "routerMac": "08:8A:F1:9D:1B:46"}	matched	1.0000	{"rule": "exact_case_insensitive_pppoe_username", "source": "mikrotik_ppp_active"}	2026-10-12 10:45:53.768314+00	2026-10-12 10:45:53.768314+00
\.


ALTER TABLE public.network_observations ENABLE TRIGGER ALL;

--
-- Data for Name: network_topology_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.network_topology_links DISABLE TRIGGER ALL;

COPY public.network_topology_links (id, from_device_id, to_device_id, relationship, source_observation_id, match_status, evidence, first_seen_at, last_seen_at, created_at, updated_at) FROM stdin;
\.


ALTER TABLE public.network_topology_links ENABLE TRIGGER ALL;

--
-- Data for Name: notification_delivery_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_delivery_logs DISABLE TRIGGER ALL;

COPY public.notification_delivery_logs (id, channel, provider, recipient, message_body, status, transaction_id, provider_message_id, error_message, created_at, sent_at, delivered_at) FROM stdin;
1	whatsapp	WhatsApp	01710415717	FAZ NETWORK WhatsApp test message	pending	\N	\N	\N	2026-10-22 00:08:59.99665+00	\N	\N
2	whatsapp	WhatsApp	8801710415717	আসসালামু আলাইকুম Rabbi, FAZ NETWORK-এ আপনার হটস্পট অ্যাকাউন্ট তৈরি করা হয়েছে।\nUsername: 01710415717\nPackage: 5 M\nপ্রথম সফল লগইনে ডিভাইস স্বয়ংক্রিয়ভাবে bind হবে এবং মেয়াদ শুরু হবে।	pending	\N	\N	\N	2026-10-22 00:26:44.941814+00	\N	\N
3	whatsapp	WhatsApp	8801814237287	আসসালামু আলাইকুম Rabbi, FAZ NETWORK-এ আপনার হটস্পট অ্যাকাউন্ট তৈরি করা হয়েছে।\nUsername: FZNZU5A5RUY\nPackage: 5 M\nপ্রথম সফল লগইনে ডিভাইস স্বয়ংক্রিয়ভাবে bind হবে এবং মেয়াদ শুরু হবে।	pending	\N	\N	\N	2026-10-22 01:54:56.104145+00	\N	\N
4	whatsapp	WhatsApp	8801710415717	আসসালামু আলাইকুম Rabbi, FAZ NETWORK-এ আপনার হটস্পট অ্যাকাউন্ট তৈরি করা হয়েছে।\nUsername: FZN3EYFWV63\nPackage: 5 M\nপ্রথম সফল লগইনে ডিভাইস স্বয়ংক্রিয়ভাবে bind হবে এবং মেয়াদ শুরু হবে।	pending	\N	\N	\N	2026-10-22 05:44:30.429025+00	\N	\N
5	whatsapp	WhatsApp	8801710415717	আসসালামু আলাইকুম Rabbi, আপনার FAZ NETWORK হটস্পট প্যাকেজের মেয়াদ আগামী ৫ মিনিটের মধ্যে শেষ হতে যাচ্ছে। নিরবচ্ছিন্ন ইন্টারনেট সংযোগ বজায় রাখতে এখনই রিচার্জ করুন। হেল্পলাইন: 01339932887	pending	\N	\N	\N	2026-10-22 05:46:31.348164+00	\N	\N
6	whatsapp	WhatsApp	8801710415717	Dear 01710415717, your internet connection has expired. Please recharge via bKash/Nagad to reactivate your internet immediately. Helpline: 01339932887	pending	\N	\N	\N	2026-10-22 05:51:32.307587+00	\N	\N
7	whatsapp	WhatsApp	8801723250330	Dear Muslim Uddin,\n\nWe are pleased to inform you that your internet subscription has been successfully renewed.\n\nAccount Details:\nUsername: muslim1234\nPlan: 45 Mbps\nAmount Paid: 500 BDT\nValidity: Until 2026-11-22\n\nThank you for choosing our service. If you require any technical assistance or have billing inquiries, please reach out to our support team at 013399-32887 or visit faznetwork.com.	pending	\N	\N	\N	2026-10-22 07:53:49.004238+00	\N	\N
\.


ALTER TABLE public.notification_delivery_logs ENABLE TRIGGER ALL;

--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_templates DISABLE TRIGGER ALL;

COPY public.notification_templates (id, event_key, channel, template_body, email_subject, email_body, is_active, created_at, updated_at) FROM stdin;
4	pppoe_expired	whatsapp	প্রিয় {name}, আপনার FAZ NETWORK প্যাকেজ {package} মেয়াদ আজ শেষ হয়েছে এবং সংযোগটি সাময়িকভাবে বন্ধ রয়েছে। সংযোগটি পুনরায় চালু করতে রিচার্জ করুন। ধন্যবাদ।	\N	\N	t	2026-10-16 00:49:32.904712+00	2026-10-16 00:49:32.904712+00
6	pppoe_renewal	email	প্রিয় {name}, \nআপনার ইন্টারনেট সংযোগ সফলভাবে রিনিউ করা হয়েছে। \n• ইউজারনেম: {username}\n• প্যাকেজ: {package}\n• বিলের পরিমাণ: {amount} টাকা।\n• নতুন মেয়াদ: {expiry_date} পর্যন্ত।\nযেকোনো প্রয়োজনে কল করুন: 013399-32887\nWebsite: faznetwork.com	Service renewal confirmed - {company_name}	প্রিয় {name}, \nআপনার ইন্টারনেট সংযোগ সফলভাবে রিনিউ করা হয়েছে। \n• ইউজারনেম: {username}\n• প্যাকেজ: {package}\n• বিলের পরিমাণ: {amount} টাকা।\n• নতুন মেয়াদ: {expiry_date} পর্যন্ত।\nযেকোনো প্রয়োজনে কল করুন: 013399-32887\nWebsite: faznetwork.com	t	2026-10-16 04:41:09.920919+00	2026-10-16 04:41:09.920919+00
7	hotspot_purchase	whatsapp	Dear {name}, your Hotspot package {package} purchase is confirmed for Tk {amount}.	\N	\N	t	2026-10-18 03:08:21.034561+00	2026-10-18 03:08:21.034561+00
10	pppoe_payment	whatsapp	Dear {name}, payment of Tk {amount} received. Your service is active until {expiry_date}. Thank you for choosing Faz Network! For support, call 013399-32887 or visit faznetwork.com.	\N	\N	t	2026-10-23 11:45:50.579085+00	2026-10-23 11:45:50.579085+00
2	pppoe_expiry_warning	whatsapp	প্রিয় {name},\n\nআপনার {company_name} সংযোগের মেয়াদ আগামী {expiry_date} তারিখে শেষ হবে। নিরবচ্ছিন্ন সেবা চালু রাখতে দ্রুত বিল পরিশোধ করুন।\n\n• বিলের পরিমাণ: {amount} টাকা\n• ইউজারনেম: {username}\n\n💳 পেমেন্ট পদ্ধতি (bKash / Nagad Send Money):\nনম্বর: 013399-32887(Personal).\n\n⚠️ বিশেষ দ্রষ্টব্য: বিকাশ বা নগদে Send Money করার সময় Reference (রেফারেন্স)-এর ঘরে অবশ্যই আপনার {username} লিখবেন।\n\nপেমেন্ট শেষে কল/মেসেজ করুন: 013399-32887\n- {company_name}	\N	\N	t	2026-10-16 00:29:47.399156+00	2026-10-23 11:46:22.363148+00
1	pppoe_renewal	whatsapp	Dear {name},\n\nYour {package} subscription is renewed until {expiry_date}.\n\nUsername: {username}\n\nAmount Paid: {amount} BDT\n\nFor support, call 013399-32887 or visit faznetwork.com.	\N	\N	t	2026-10-16 00:22:02.336174+00	2026-10-23 11:47:03.545367+00
\.


ALTER TABLE public.notification_templates ENABLE TRIGGER ALL;

--
-- Data for Name: packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.packages DISABLE TRIGGER ALL;

COPY public.packages (id, plan_name, pool_name, profile_name, rate_limit, price, duration_months, created_at, updated_at, local_address, remote_address, dns_server, change_tcp_mss) FROM stdin;
3	default		default	\N	0.00	1	2026-10-08 09:30:46.174745+00	2026-10-08 10:26:16.759267+00			8.8.8.8,1.1.1.1	yes
4	vpn		vpn	\N	0.00	1	2026-10-08 09:30:46.178202+00	2026-10-08 10:26:16.761706+00			8.8.8.8,1.1.1.1	yes
5	Expired_Profile	Expire_Pool	Expired_Profile	\N	0.00	1	2026-10-08 09:30:46.180649+00	2026-10-08 10:26:16.763759+00	100.65.96.1	Expire_Pool	8.8.8.8,1.1.1.1	yes
9	default-encryption		default-encryption	\N	0.00	1	2026-10-08 09:30:46.197224+00	2026-10-08 10:26:16.771565+00			8.8.8.8,1.1.1.1	yes
19	45 Mbps	PPPoE_Pool	45 Mbps	\N	500.00	1	2026-10-08 12:19:57.739237+00	2026-10-13 21:51:14.547603+00	10.20.0.1	PPPoE_Pool	8.8.8.8, 1.1.1.1	yes
\.


ALTER TABLE public.packages ENABLE TRIGGER ALL;

--
-- Data for Name: payment_reconciliation_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_reconciliation_audit DISABLE TRIGGER ALL;

COPY public.payment_reconciliation_audit (id, transaction_id, flow, account_identifier, details, created_at) FROM stdin;
\.


ALTER TABLE public.payment_reconciliation_audit ENABLE TRIGGER ALL;

--
-- Data for Name: payment_webhook_quarantine; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_webhook_quarantine DISABLE TRIGGER ALL;

COPY public.payment_webhook_quarantine (id, status, rejection_code, raw_payload, received_at) FROM stdin;
1	unmatched	UNTRUSTED_FORWARDER_SENDER	{"sender": "[SMS_NUMBER]", "message": "[SMS_BODY]", "recipient": "[RECEIVING_NUMBER]"}	2026-10-23 01:43:35.213686+00
2	unmatched	UNTRUSTED_FORWARDER_SENDER	{"sender": "[SMS_NUMBER]", "message": "[SMS_BODY]", "recipient": "[RECEIVING_NUMBER]"}	2026-10-23 01:51:28.627751+00
3	unmatched	UNTRUSTED_FORWARDER_SENDER	{}	2026-10-23 02:08:12.339587+00
4	unmatched	UNTRUSTED_FORWARDER_SENDER	{}	2026-10-23 02:20:30.643343+00
5	unmatched	UNTRUSTED_FORWARDER_SENDER	{}	2026-10-24 21:14:14.098087+00
6	unmatched	UNTRUSTED_FORWARDER_SENDER	{"sender": "[SMS_SENDER]", "message": "[SMS_BODY]", "recipient": "[RECEIVING_NUMBER]"}	2026-10-25 22:52:04.119594+00
7	unmatched	UNTRUSTED_FORWARDER_SENDER	{"sender": "[SMS_SENDER]", "message": "[SMS_BODY]", "recipient": "[RECEIVING_NUMBER]"}	2026-10-26 06:13:37.432358+00
\.


ALTER TABLE public.payment_webhook_quarantine ENABLE TRIGGER ALL;

--
-- Data for Name: pppoe_live_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.pppoe_live_sessions DISABLE TRIGGER ALL;

COPY public.pppoe_live_sessions (username, address, uptime, service, bytes_in, bytes_out, caller_id, received_at) FROM stdin;
10012	10.20.0.249	00:24:03	pppoe	3985352	79400160	30:68:93:10:4F:7A	2026-10-24 00:36:40.503124+00
10010	10.20.0.247	00:23:20	pppoe	10218467	140845035	7C:F1:7E:88:7B:78	2026-10-24 00:36:40.503124+00
10003	10.20.0.245	00:23:20	pppoe	43652	73643	B0:19:21:13:E3:9B	2026-10-24 00:36:40.503124+00
10013	10.20.0.250	00:23:20	pppoe	27324	55588	08:8A:F1:9D:1B:46	2026-10-24 00:36:40.503124+00
10008	10.20.0.253	00:23:19	pppoe	2375656	39494727	08:8A:F1:10:D8:CA	2026-10-24 00:36:40.503124+00
muslim1234	10.20.0.246	00:23:18	pppoe	13602719	191177961	B0:19:21:03:5A:38	2026-10-24 00:36:40.503124+00
10004	10.20.0.251	00:23:15	pppoe	6983945	46986227	08:8A:F1:04:32:71	2026-10-24 00:36:40.503124+00
shafikul404	10.20.0.244	00:23:13	pppoe	416389	1472603	30:07:5C:73:39:AB	2026-10-24 00:36:40.503124+00
10001	10.20.0.248	00:23:12	pppoe	54559	70691	08:8A:F1:8F:63:D6	2026-10-24 00:36:40.503124+00
10007	10.20.0.243	00:23:12	pppoe	1974539	3162057	30:07:5C:D9:61:EB	2026-10-24 00:36:40.503124+00
mithun1234	10.20.0.254	00:22:58	pppoe	58818019	920190009	80:AF:CA:70:B3:59	2026-10-24 00:36:40.503124+00
10011	10.20.0.242	00:22:43	pppoe	922960	1563839	BC:E0:01:7C:CC:0B	2026-10-24 00:36:40.503124+00
ratanchandra854	10.20.0.241	00:22:41	pppoe	7929072	267564741	30:07:5C:D9:6B:5A	2026-10-24 00:36:40.503124+00
prodip1234	10.20.0.240	00:22:41	pppoe	3949347	44320040	BC:E0:01:AF:F7:C7	2026-10-24 00:36:40.503124+00
10009	10.20.0.252	00:22:40	pppoe	12964035	250023700	40:AE:30:F1:C4:B0	2026-10-24 00:36:40.503124+00
1010	10.20.0.238	00:21:29	pppoe	650869	1197256	40:ED:00:32:62:81	2026-10-24 00:36:40.503124+00
10005	10.20.0.239	00:21:18	pppoe	7103802	204100159	8C:90:2D:34:77:E1	2026-10-24 00:36:40.503124+00
\.


ALTER TABLE public.pppoe_live_sessions ENABLE TRIGGER ALL;

--
-- Data for Name: pppoe_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.pppoe_profiles DISABLE TRIGGER ALL;

COPY public.pppoe_profiles (id, name, rate_limit, local_address, remote_address, session_timeout, idle_timeout, only_one, change_tcp_mss, comment, price, router_id, raw_config, synced_at, created_at, updated_at) FROM stdin;
1	default						f	default		0.00	103.54.37.182	{".id": "*0", "name": "default", "on-up": "", "default": "true", "on-down": "", "only-one": "yes", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "dns-server": "8.8.8.8,1.1.1.1", "address-list": "", "change-tcp-mss": "yes", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-08 06:10:18.246568+00	2026-10-07 20:47:39.225965+00	2026-10-08 06:10:18.246568+00
2	vpn						f	default		0.00	103.54.37.182	{".id": "*1", "name": "vpn", "on-up": "", "default": "false", "on-down": "", "only-one": "default", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "dns-server": "8.8.8.8,1.1.1.1", "address-list": "", "change-tcp-mss": "yes", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-08 06:10:18.246568+00	2026-10-07 20:47:39.225965+00	2026-10-08 06:10:18.246568+00
3	Expired_Profile		100.65.96.1	Expire_Pool			f	default		0.00	103.54.37.182	{".id": "*F", "name": "Expired_Profile", "on-up": "", "default": "false", "on-down": "", "only-one": "default", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "address-list": "SuspendedUsersPool", "local-address": "100.65.96.1", "change-tcp-mss": "default", "remote-address": "Expire_Pool", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-09 23:31:37.152004+00	2026-10-07 20:47:39.225965+00	2026-10-09 23:31:37.152004+00
4	FZN 30 Mbps		10.81.0.1	100 mbps			f	default	Auto-generated for Plan: PLAN-0166	0.00	103.54.37.182	{".id": "*3", "name": "FZN 30 Mbps", "on-up": "", "comment": "Auto-generated for Plan: PLAN-0166", "default": "false", "on-down": "", "only-one": "yes", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "dns-server": "8.8.8.8,1.1.1.1", "address-list": "", "local-address": "10.81.0.1", "change-tcp-mss": "yes", "remote-address": "100 mbps", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-08 06:10:18.246568+00	2026-10-07 20:47:39.225965+00	2026-10-08 06:10:18.246568+00
5	FZN 50 Mbps		10.82.0.1	150 Mbps			f	default	Auto-generated for Plan: PLAN-0167	0.00	103.54.37.182	{".id": "*4", "name": "FZN 50 Mbps", "on-up": "", "comment": "Auto-generated for Plan: PLAN-0167", "default": "false", "on-down": "", "only-one": "yes", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "dns-server": "8.8.8.8,1.1.1.1", "address-list": "", "local-address": "10.82.0.1", "change-tcp-mss": "yes", "remote-address": "150 Mbps", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-08 06:10:18.246568+00	2026-10-07 20:47:39.225965+00	2026-10-08 06:10:18.246568+00
6	Userman Hotspot		10.15.20.1	Userman Hotspot			f	default	Userman Hotspot	0.00	103.54.37.182	{".id": "*5", "name": "Userman Hotspot", "on-up": "", "comment": "Userman Hotspot", "default": "false", "on-down": "", "only-one": "yes", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "address-list": "", "local-address": "10.15.20.1", "change-tcp-mss": "yes", "remote-address": "Userman Hotspot", "use-encryption": "no", "bridge-learning": "default", "use-compression": "default"}	2026-10-08 06:10:18.246568+00	2026-10-07 20:47:39.225965+00	2026-10-08 06:10:18.246568+00
7	default-encryption						f	default		0.00	103.54.37.182	{".id": "*FFFFFFFE", "name": "default-encryption", "on-up": "", "default": "true", "on-down": "", "only-one": "default", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "dns-server": "8.8.8.8,1.1.1.1", "address-list": "", "change-tcp-mss": "yes", "use-encryption": "yes", "bridge-learning": "default", "use-compression": "default"}	2026-10-08 06:10:18.246568+00	2026-10-07 20:47:39.225965+00	2026-10-08 06:10:18.246568+00
177	FZN 40 Mbps			100 mbps			f	default		0.00	103.54.37.182	{".id": "*6", "name": "FZN 40 Mbps", "on-up": "", "default": "false", "on-down": "", "only-one": "default", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "address-list": "", "change-tcp-mss": "default", "remote-address": "100 mbps", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-08 06:10:18.246568+00	2026-10-08 06:10:18.246568+00	2026-10-08 06:10:18.246568+00
178	FZN 60 Mbps			150 Mbps			f	default		0.00	103.54.37.182	{".id": "*7", "name": "FZN 60 Mbps", "on-up": "", "default": "false", "on-down": "", "only-one": "default", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "address-list": "", "change-tcp-mss": "default", "remote-address": "150 Mbps", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-08 06:10:18.246568+00	2026-10-08 06:10:18.246568+00	2026-10-08 06:10:18.246568+00
209	45 Mbps		10.20.30.1	PPPoE_Pool			f	yes	500 Tk	0.00	103.54.37.182	{".id": "*B", "name": "45 Mbps", "on-up": "", "comment": "500 Tk", "default": "false", "on-down": "", "only-one": "default", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "dns-server": "8.8.8.8,1.1.1.1", "rate-limit": "", "address-list": "", "local-address": "10.20.30.1", "change-tcp-mss": "yes", "remote-address": "PPPoE_Pool", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-09 23:31:37.152004+00	2026-10-09 23:26:26.016676+00	2026-10-09 23:31:37.152004+00
210	EXPIRED-PROFILE	1k/1k	100.65.96.1	Expire_Pool			f	default		0.00	103.54.37.182	{".id": "*D", "name": "EXPIRED-PROFILE", "on-up": "", "default": "false", "on-down": "", "only-one": "default", "use-ipv6": "yes", "use-mpls": "default", "use-upnp": "default", "rate-limit": "1k/1k", "address-list": "", "local-address": "100.65.96.1", "change-tcp-mss": "default", "remote-address": "Expire_Pool", "use-encryption": "default", "bridge-learning": "default", "use-compression": "default"}	2026-10-09 23:31:37.152004+00	2026-10-09 23:26:26.016676+00	2026-10-09 23:31:37.152004+00
\.


ALTER TABLE public.pppoe_profiles ENABLE TRIGGER ALL;

--
-- Data for Name: pppoe_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.pppoe_users DISABLE TRIGGER ALL;

COPY public.pppoe_users (id, username, password, profile, service, caller_id, disabled, comment, phone, local_address, remote_address, router_id, raw_config, synced_at, created_at, updated_at, status, expiry_date, billing_status, last_paid_at, paid_until) FROM stdin;
655	1011	1011	EXPIRED-PROFILE	pppoe	BC:62:CE:0A:54:3C	f	EXP: 2026-11-25	01770708734	\N	\N	103.54.37.182	{}	2026-10-25 13:57:25.640979+00	2026-10-10 13:55:14.614978+00	2026-10-25 13:57:25.640979+00	active	2026-11-25	paid	2026-10-25 13:57:25.640979+00	2026-11-25
557	10005	10005	45 Mbps	pppoe	8C:90:2D:34:77:E1	f	EXP: 2026-11-04	01611939762	\N	\N	103.54.37.182	{}	2026-10-10 16:25:02.529048+00	2026-10-10 00:45:48.555028+00	2026-10-10 16:25:02.529048+00	active	2026-11-04	unpaid	\N	\N
753	10014	10014	EXPIRED-PROFILE	pppoe	\N	f	EXP: 2026-10-22	01305155068	\N	\N	103.54.37.182	{}	2026-10-23 05:25:30.262875+00	2026-10-23 05:14:49.921019+00	2026-10-23 05:25:30.262875+00	expired	2026-10-22	unpaid	\N	\N
736	10010	10010	45 Mbps	pppoe	7C:F1:7E:88:7B:78	f	EXP: 2026-11-16	01796730594	\N	\N	103.54.37.182	{}	2026-10-25 00:53:00.521153+00	2026-10-15 19:33:22.26287+00	2026-10-25 00:53:00.521153+00	active	2026-11-16	paid	2026-10-16 12:46:29.622327+00	2026-11-16
490	10003	10003	45 Mbps	pppoe	B0:19:21:13:E3:9B	f	EXP: 2026-11-09	01714594628		\N	103.54.37.182	{".id": "*B6", "name": "10003", "routes": "", "comment": "EXP: 2026-11-09", "profile": "45 Mbps", "service": "pppoe", "disabled": "false", "password": "10003", "caller-id": "", "ipv6-routes": "", "last-caller-id": "B0:19:21:13:E3:9B", "limit-bytes-in": "0", "last-logged-out": "2026-10-10 05:01:04", "limit-bytes-out": "0", "last-disconnect-reason": "peer-request"}	2026-10-25 00:52:59.387114+00	2026-10-09 05:29:19.374051+00	2026-10-25 00:52:59.387114+00	active	2026-11-09	paid	\N	2026-11-09
491	10004	10004	45 Mbps	pppoe	08:8A:F1:04:32:71	f	EXP: 2026-11-09	01611939732			103.54.37.182	{".id": "*B7", "name": "10004", "routes": "", "comment": "EXP: 2026-11-09", "profile": "45 Mbps", "service": "pppoe", "disabled": "false", "password": "10004", "caller-id": "", "ipv6-routes": "", "last-caller-id": "08:8A:F1:04:32:71", "limit-bytes-in": "0", "last-logged-out": "2026-10-10 05:01:32", "limit-bytes-out": "0", "last-disconnect-reason": "peer-request"}	2026-10-25 00:52:59.470261+00	2026-10-09 05:32:32.421705+00	2026-10-25 00:52:59.470261+00	active	2026-11-09	paid	2026-10-09 15:02:37.028631+00	2026-11-09
3	shafikul404	1234	45 Mbps	pppoe	30:07:5C:73:39:AB	f	EXP: 2026-11-13	01787805753			103.54.37.182	{".id": "*53", "name": "shafikul404", "routes": "", "comment": "EXP: 2026-10-13", "profile": "45 Mbps", "service": "pppoe", "disabled": "false", "password": "1234", "caller-id": "30:07:5C:73:39:AB", "ipv6-routes": "", "last-caller-id": "30:07:5C:73:39:AB", "limit-bytes-in": "0", "last-logged-out": "2026-10-10 04:37:23", "limit-bytes-out": "0", "last-disconnect-reason": "nas-request"}	2026-10-25 00:52:59.545396+00	2026-10-07 20:47:39.225965+00	2026-10-25 00:52:59.545396+00	active	2026-11-13	paid	2026-10-12 15:36:38.726059+00	2026-11-13
20	prodip1234	1234	45 Mbps	pppoe	BC:E0:01:AF:F7:C7	f	EXP: 2026-11-03	01775521817			103.54.37.182	{".id": "*A7", "name": "prodip1234", "routes": "", "comment": "Exp: 2026-11-03", "profile": "FZN 30 Mbps", "service": "pppoe", "disabled": "false", "password": "1234", "caller-id": "BC:E0:01:AF:F7:C7", "ipv6-routes": "", "last-caller-id": "BC:E0:01:AF:F7:C7", "limit-bytes-in": "0", "last-logged-out": "2026-10-05 05:02:03", "limit-bytes-out": "0", "last-disconnect-reason": "hung-up"}	2026-10-25 00:52:59.621143+00	2026-10-07 20:47:39.225965+00	2026-10-25 00:52:59.621143+00	active	2026-11-03	unpaid	\N	\N
591	10009	10009	45 Mbps	pppoe	40:AE:30:F1:C4:B0	f	EXP: 2026-11-22	01774036879	\N	\N	103.54.37.182	{}	2026-10-25 00:52:59.696292+00	2026-10-10 05:46:20.072626+00	2026-10-25 00:52:59.696292+00	active	2026-11-22	paid	2026-10-22 12:56:39.393397+00	2026-11-22
2	ratanchandra854	1234	45 Mbps	pppoe	30:07:5C:D9:6B:5A	f	EXP: 2026-11-11	01728541854			103.54.37.182	{".id": "*AF", "name": "ratanchandra854", "routes": "", "comment": "Exp: 2026-10-11", "profile": "FZN 30 Mbps", "service": "pppoe", "disabled": "false", "password": "1234", "caller-id": "", "ipv6-routes": "", "limit-bytes-in": "0", "last-logged-out": "1970-01-01 00:00:00", "limit-bytes-out": "0"}	2026-10-25 00:52:59.77127+00	2026-10-07 20:47:39.225965+00	2026-10-25 00:52:59.77127+00	active	2026-11-11	paid	2026-10-11 03:59:18.732462+00	2026-11-11
11	muslim1234	1234	45 Mbps	pppoe	B0:19:21:03:5A:38	f	EXP: 2026-11-22	01723250330		\N	103.54.37.182	{".id": "*82", "name": "muslim1234", "routes": "", "comment": "Exp: 2026-10-22", "profile": "FZN 30 Mbps", "service": "pppoe", "disabled": "false", "password": "1234", "caller-id": "B0:19:21:03:5A:38", "ipv6-routes": "", "last-caller-id": "B0:19:21:03:5A:38", "limit-bytes-in": "0", "last-logged-out": "2026-10-08 09:15:54", "limit-bytes-out": "0", "last-disconnect-reason": "hung-up"}	2026-10-25 00:52:59.845991+00	2026-10-07 20:47:39.225965+00	2026-10-25 00:52:59.845991+00	active	2026-11-22	paid	2026-10-22 07:53:48.598368+00	2026-11-22
554	10001	10001	45 Mbps	pppoe	08:8A:F1:8F:63:D6	f	EXP: 2026-11-10	01764867748	\N	\N	103.54.37.182	{}	2026-10-25 00:52:59.922512+00	2026-10-10 00:38:39.750413+00	2026-10-25 00:52:59.922512+00	active	2026-11-10	paid	2026-10-10 18:01:57.28797+00	2026-11-10
556	10002	10002	45 Mbps	pppoe	CC:2D:21:01:B5:67	f	EXP: 2026-11-11	01742671956	\N	\N	103.54.37.182	{}	2026-10-25 00:52:59.997524+00	2026-10-10 00:42:08.512018+00	2026-10-25 00:52:59.997524+00	active	2026-11-11	paid	2026-10-11 13:44:41.884623+00	2026-11-11
559	10007	10007	45 Mbps	pppoe	30:07:5C:D9:61:EB	f	EXP: 2026-11-18	01738204194	\N	\N	103.54.37.182	{}	2026-10-25 00:53:00.072468+00	2026-10-10 00:52:05.386598+00	2026-10-25 00:53:00.072468+00	active	2026-11-18	paid	2026-10-18 01:57:59.136795+00	2026-11-18
575	10008	10008	45 Mbps	pppoe	08:8A:F1:10:D8:CA	f	EXP: 2026-11-11	01716832502	\N	\N	103.54.37.182	{}	2026-10-25 00:53:00.147151+00	2026-10-10 01:21:48.297473+00	2026-10-25 00:53:00.147151+00	active	2026-11-11	paid	2026-10-11 03:02:45.514539+00	2026-11-11
653	1010	1010	45 Mbps	pppoe	40:ED:00:32:62:81	f	EXP: 2026-11-22	01332081110	\N	\N	103.54.37.182	{}	2026-10-25 00:53:00.221827+00	2026-10-10 13:33:53.069057+00	2026-10-25 00:53:00.221827+00	active	2026-11-22	paid	2026-10-21 14:45:10.467327+00	2026-11-22
675	10012	10012	45 Mbps	pppoe	30:68:93:10:4F:7A	f	EXP: 2026-11-05	01773893420	\N	\N	103.54.37.182	{}	2026-10-25 00:53:00.296552+00	2026-10-10 15:38:58.8158+00	2026-10-25 00:53:00.296552+00	active	2026-11-05	paid	\N	2026-11-05
677	mithun1234	1234	45 Mbps	pppoe	80:AF:CA:70:B3:59	f	EXP: 2026-11-02	01737576877	\N	\N	103.54.37.182	{}	2026-10-25 00:53:00.371595+00	2026-10-10 17:33:54.161557+00	2026-10-25 00:53:00.371595+00	active	2026-11-02	unpaid	\N	\N
681	10006	10006	45 Mbps	pppoe	10:5A:95:70:2D:C9	f	EXP: 2027-02-23	01710415717	\N	PPPoE_Pool	103.54.37.182	{}	2026-10-25 00:53:00.446269+00	2026-10-10 20:32:51.77183+00	2026-10-25 00:53:00.446269+00	active	2027-02-23	paid	2026-10-24 21:26:48.383962+00	2027-01-23
737	10011	10011	45 Mbps	pppoe	BC:E0:01:7C:CC:0B	f	EXP: 2026-11-18	01763236150	\N	\N	103.54.37.182	{}	2026-10-25 00:53:00.59586+00	2026-10-18 04:04:06.087705+00	2026-10-25 00:53:00.59586+00	active	2026-11-18	paid	2026-10-18 04:04:32.399879+00	2026-11-18
743	10013	10013	45 Mbps	pppoe	08:8A:F1:9D:1B:46	f	EXP: 2026-11-21	01767094042	\N	\N	103.54.37.182	{}	2026-10-25 00:53:00.670604+00	2026-10-21 13:07:39.154087+00	2026-10-25 00:53:00.670604+00	active	2026-11-21	unpaid	\N	\N
\.


ALTER TABLE public.pppoe_users ENABLE TRIGGER ALL;

--
-- Data for Name: public_payment_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.public_payment_sessions DISABLE TRIGGER ALL;

COPY public.public_payment_sessions (session_id, username, provider, amount, expires_at, created_at) FROM stdin;
a245471ef2585dd1475d020172253f6e1c417afa8ad5f3f1c7f5cba0a93c8512	10006	bkash	500.00	2026-10-25 15:20:20.844+00	2026-10-25 15:15:20.881054+00
\.


ALTER TABLE public.public_payment_sessions ENABLE TRIGGER ALL;

--
-- Data for Name: router_devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.router_devices DISABLE TRIGGER ALL;

COPY public.router_devices (id, router_name, host, api_type, api_port, username, password_encrypted, use_ssl, timeout_ms, status, last_synced, board_model, ros_version, cpu_load, identity, created_at, updated_at) FROM stdin;
2	RB 4011	103.54.37.182	native_api	1039	smsbot	1bBHDbl+oSM3Y1CS.3cB1jn3rDTeVUzyyXGLG7g==.6eXHtMk=	f	5000	online	2026-10-18 17:56:36.390123+00	RB4011iGS+	7.24.4 (stable)	2	Tp-link	2026-10-18 17:56:36.390123+00	2026-10-18 17:56:36.390123+00
\.


ALTER TABLE public.router_devices ENABLE TRIGGER ALL;

--
-- Data for Name: server_settings_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.server_settings_audit DISABLE TRIGGER ALL;

COPY public.server_settings_audit (id, actor_id, actor_label, action, setting_key, details, created_at) FROM stdin;
1	\N	admin	token_generated	android_sms_gateway_token_hash	{}	2026-10-19 22:00:07.41081+00
2	\N	admin	token_generated	master_webhook_token_hash	{}	2026-10-19 22:00:38.867701+00
3	\N	admin	tenant_created	\N	{"slug": "isp", "tenantId": "1", "termDays": 30}	2026-10-19 22:07:03.075198+00
4	\N	admin	tenant_modules	\N	{"action": "modules", "tenantId": 1}	2026-10-19 22:07:24.672596+00
5	\N	admin	tenant_deleted	\N	{"name": "Al Amin", "slug": "isp", "tenantId": 1}	2026-10-19 23:24:08.769144+00
6	\N	admin	tenant_invitation_created	\N	{"slug": "isp", "tenantId": 2, "termDays": 30, "initialAdminEmail": "faznetwork.com@gmail.com", "invitationExpiresHours": 48}	2026-10-19 23:24:25.912087+00
7	\N	admin	tenant_deleted	\N	{"name": "Rabbi", "slug": "isp", "tenantId": 2}	2026-10-19 23:31:17.606474+00
8	\N	admin	tenant_invitation_created	\N	{"slug": "isp", "tenantId": 3, "termDays": 30, "initialAdminEmail": "fozle5207@gmail.com", "invitationExpiresHours": 48}	2026-10-19 23:31:47.804061+00
9	\N	admin	tenant_deleted	\N	{"name": "Rabbi", "slug": "isp", "tenantId": 3}	2026-10-19 23:37:20.535757+00
10	\N	admin	tenant_invitation_created	\N	{"slug": "isp", "tenantId": 4, "termDays": 30, "initialAdminEmail": "fozle5207@gmail.com", "invitationExpiresHours": 48}	2026-10-19 23:37:48.664796+00
11	\N	admin	tenant_modules	\N	{"action": "modules", "tenantId": 4}	2026-10-20 02:59:54.904146+00
12	\N	admin	tenant_deleted	\N	{"name": "Rabbi", "slug": "isp", "tenantId": 4}	2026-10-20 07:38:31.806846+00
13	\N	admin	tenant_invitation_created	\N	{"slug": "isp", "tenantId": 1, "termDays": 30, "initialAdminEmail": "fozle5207@gmail.com", "invitationExpiresHours": 48}	2026-10-20 07:58:33.595415+00
\.


ALTER TABLE public.server_settings_audit ENABLE TRIGGER ALL;

--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.session DISABLE TRIGGER ALL;

COPY public.session (sid, sess, expire) FROM stdin;
_2bKBkkREMxqGdzLZONgxgQeWdRIA5QL	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-09T10:33:23.522Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"pendingOtpUserId":"1","pendingOtpNext":"/admin","pendingOtpIssuedAt":1791628422798,"pendingOtpAttempts":0}	2026-11-09 10:33:24
4tL8mBBeaVX6Huk4hIpTnE4XnP8acG5O	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-07T12:30:47.912Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","loginAt":1791462647919}	2026-11-07 12:30:56
7SxC67VIZQXU19cw34PeljwC5wtc9bCs	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-07T12:33:27.403Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","loginAt":1791462807403}	2026-11-10 15:51:28
aW-aJgLki8MS-5U8mzi0ct_Ky1J11iAa	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-09T12:59:33.474Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"ohid","role":"admin","userId":"6","legacySuperAdmin":false,"loginAt":1791637173186}	2026-11-10 02:52:07
_EepRh_F9V0Zhhjgeo1aZYZsRVNnBwtE	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-09T10:44:41.270Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"pendingOtpUserId":"1","pendingOtpNext":"/admin","pendingOtpIssuedAt":1791629085500,"pendingOtpAttempts":0}	2026-11-09 10:44:42
eFYpVMewCV-l_mvIxPhbI5iOfJ3zb54D	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-07T12:37:33.601Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","loginAt":1791463053609}	2026-11-07 12:45:35
H6sg-a3Q7ZygDmT_8oXcMDelwVgRWOIf	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-09T12:59:02.165Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2026-11-09 12:59:03
j99MgDmiM5_G6l7K4N2LtqxkRdaCOUu9	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-11T14:51:39.537Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1791816699533}	2026-11-12 06:17:20
K04wKaKwb_DjYVAEtde39Dg_RlW9aD9d	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-10T12:02:45.793Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1791720165790}	2026-11-10 16:13:53
kJl40fIu_ttbTu_wX3qNn9TZ3tr09p0e	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-09T12:58:54.868Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"ohid","role":"admin","userId":"6","legacySuperAdmin":false,"loginAt":1791637134868}	2026-11-09 12:58:55
QVvEf-QxO7lEuB_BrUAC1ERZB8W-eARw	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-12T15:31:28.601Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1791905488598}	2026-11-15 16:51:00
YeOmcpx-a85pj1U3Mj4IAFBbQPVUtRbe	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-07T12:31:21.206Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","loginAt":1791462681207}	2026-11-07 12:37:23
zWGz1EYU4oWr8E4frqSZGuS58BoTd7Nm	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-10T16:14:00.680Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1791735240677}	2026-11-10 16:26:38
eKkGHnucemEP4D-mYJt8gPwfKAipnk1U	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-23T20:48:10.849Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"rabbi","role":"super_admin","userId":"11","legacySuperAdmin":false,"loginAt":1792874890771}	2026-11-24 12:08:13
7mMtO-OELoUh2BFMTuHtJKWV3k5ZhP9x	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-25T12:48:08.033Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1793018887951}	2026-11-25 17:39:13
XrxtSSvPujTlFCFn5xOajLoJMtouvhln	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-19T08:00:56.644Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"tenantAdmin":true,"tenantId":1,"tenantName":"Rabbi","isAdmin":false,"adminUser":"rabbi","role":"admin","legacySuperAdmin":false,"loginAt":1792483256567}	2026-11-19 08:01:24
vegpgYj2bFM8JQanepvm35FKLjRuIV-u	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-18T23:56:42.964Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"tenantAdmin":true,"tenantId":4,"tenantName":"Rabbi","isAdmin":false,"adminUser":"rabbi","role":"admin","legacySuperAdmin":false,"loginAt":1792454202888}	2026-11-19 02:17:25
TGdtRDY9Y4QmST2KhTaahJ8NJmiLjUmC	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-19T11:35:50.283Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"tenantAdmin":true,"tenantId":1,"tenantName":"Rabbi","isAdmin":false,"adminUser":"rabbi","userId":"10","role":"admin","legacySuperAdmin":false,"loginAt":1792496150205}	2026-11-19 11:45:17
88J9qaStDR-9quKzDVPw7k-bROXcOsxW	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-07T14:22:58.585Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","loginAt":1791469378591}	2026-11-18 11:42:19
Otj6Dvap4oppq4-9YQlVPcALomP_dacd	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-18T15:04:11.151Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1792422251073}	2026-11-25 11:58:26
30FU6uIAaOAAfwZP2NdseEOw4RXKUTRN	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-15T16:51:20.285Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1792169480274}	2026-11-18 12:09:31
rHfO7FrUEONDo67mEJ8ceozMrzynlakN	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-19T07:37:24.873Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1792481844792}	2026-11-25 13:08:31
p9tNrQ2-KszDzqQv6GnB8QB81j-Y1f8O	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-19T08:16:16.098Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"tenantAdmin":true,"tenantId":1,"tenantName":"Rabbi","isAdmin":false,"adminUser":"rabbi","userId":"10","role":"admin","legacySuperAdmin":false,"loginAt":1792484176022}	2026-11-19 12:55:50
BMWx5jfhGk9wpE2ymy3zIxGodq2kXZOA	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-20T04:43:54.563Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1792557834483}	2026-11-25 17:31:11
5vnbefTfPKEFD60Gl9PVU4jdQcYMnc3j	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-24T03:15:13.531Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"motinmirsagor","role":"super_admin","userId":"12","legacySuperAdmin":false,"loginAt":1792898113443}	2026-11-24 03:21:10
RMZd5IGM6h_gAVeP83cSu4YbPaClROp1	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-11-18T22:34:33.117Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"isAdmin":true,"adminUser":"admin","role":"super_admin","userId":null,"legacySuperAdmin":true,"loginAt":1792449273034}	2026-11-20 04:43:25
\.


ALTER TABLE public.session ENABLE TRIGGER ALL;

--
-- Data for Name: sms_delivery_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.sms_delivery_logs DISABLE TRIGGER ALL;

COPY public.sms_delivery_logs (id, recipient_phone, message, event_key, status, gateway_mode, http_method, http_status, error, created_at, recipient_address, channel, provider_message_id, user_type) FROM stdin;
5	01999999999	আসসালামু আলাইকুম Arman islam, আপনার FAZ NETWORK হটস্পট প্যাকেজের মেয়াদ আগামী ৫ মিনিটের মধ্যে শেষ হতে যাচ্ছে। নিরবচ্ছিন্ন ইন্টারনেট সংযোগ বজায় রাখতে এখনই রিচার্জ করুন। হেল্পলাইন: 01339932887	manual	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-23 12:56:17.261935+00	01999999999	sms	\N	\N
22	01710415717	Dear Md Fozle Rabbi, payment of Tk 500 received successfully via cash. TrxID: CASH-RENEW-1792870039732. Your line is active till 2026-12-23. Thank you, FAZ NETWORK.	payment_receipt	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-24 19:27:21.017644+00	01710415717	sms	\N	\N
31	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	disabled	\N	\N	Notification skipped: event_rule_disabled	2026-10-24 21:40:19.256119+00	60:AB:67:D5:C8:3C	sms	\N	\N
32	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	baileys	\N	\N	Notification skipped: event_rule_disabled	2026-10-24 21:40:19.332137+00	60:AB:67:D5:C8:3C	whatsapp	\N	\N
33		Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	smtp	\N	\N	Notification skipped: channel_disabled	2026-10-24 21:40:19.405871+00	60:AB:67:D5:C8:3C	email	\N	\N
34	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	disabled	\N	\N	Notification skipped: event_rule_disabled	2026-10-24 21:45:56.089262+00	60:AB:67:D5:C8:3C	sms	\N	\N
35	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	baileys	\N	\N	Notification skipped: channel_disabled	2026-10-24 21:45:56.168484+00	60:AB:67:D5:C8:3C	whatsapp	\N	\N
36		Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	smtp	\N	\N	Notification skipped: missing_email	2026-10-24 21:45:56.244051+00	60:AB:67:D5:C8:3C	email	\N	\N
39	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	disabled	\N	\N	Notification skipped: event_rule_disabled	2026-10-24 22:21:39.040047+00	60:AB:67:D5:C8:3C	sms	\N	\N
40	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	baileys	\N	\N	Notification skipped: event_rule_disabled	2026-10-24 22:21:39.122804+00	60:AB:67:D5:C8:3C	whatsapp	\N	\N
41		Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	smtp	\N	\N	Notification skipped: channel_disabled	2026-10-24 22:21:39.198664+00	60:AB:67:D5:C8:3C	email	\N	\N
42	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	disabled	\N	\N	Notification skipped: invalid_phone	2026-10-24 22:24:46.919028+00	60:AB:67:D5:C8:3C	sms	\N	\N
43	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	baileys	\N	\N	Notification skipped: invalid_phone	2026-10-24 22:24:46.996997+00	60:AB:67:D5:C8:3C	whatsapp	\N	\N
44		Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	smtp	\N	\N	Notification skipped: missing_email	2026-10-24 22:24:47.069508+00	60:AB:67:D5:C8:3C	email	\N	\N
45	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	disabled	\N	\N	Notification skipped: event_rule_disabled	2026-10-24 22:27:25.219851+00	60:AB:67:D5:C8:3C	sms	\N	\N
46	60:AB:67:D5:C8:3C	Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	baileys	\N	\N	Notification skipped: event_rule_disabled	2026-10-24 22:27:25.297821+00	60:AB:67:D5:C8:3C	whatsapp	\N	\N
47		Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.	expiry_warning	skipped	smtp	\N	\N	Notification skipped: channel_disabled	2026-10-24 22:27:25.372824+00	60:AB:67:D5:C8:3C	email	\N	\N
48	01710415717	Dear Md Fozle Rabbi, payment of Tk 500.00 received successfully via bkash. TrxID: DJP5HXK4KL. Your line is active till 2027-02-23. Thank you, FAZ NETWORK.	payment_receipt	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 00:11:32.932003+00	01710415717	sms	\N	pppoe
49	8801710415717	Dear Md Fozle Rabbi,\n\nYour 45 Mbps subscription is renewed until 2027-02-23.\n\nUsername: 10006\n\nAmount Paid: 500.00 BDT\n\nFor support, call 013399-32887 or visit faznetwork.com.	renewal	sent	baileys	\N	\N	\N	2026-10-25 00:11:33.707035+00	8801710415717	whatsapp	3EB083C4559DBBB980F2B3	pppoe
50		[sensitive email payload omitted]	admin_invitation	sent	resend	\N	\N	\N	2026-10-25 03:08:31.673916+00	motinmir.vision@gmail.com	email	01a17107-fd56-72bb-a627-00799e20df0b	\N
51		Email notification delivered successfully.	admin_invitation	sent	email_outbox	\N	\N	\N	2026-10-25 03:08:31.917111+00	motinmir.vision@gmail.com	email	01a17107-fd56-72bb-a627-00799e20df0b	\N
52		[sensitive email payload omitted]	admin_invitation	sent	resend	\N	\N	\N	2026-10-25 03:09:57.773846+00	fozlerabbi.official.gmcservice@gmail.com	email	01a17109-4dab-7a33-826f-e2e24e909316	\N
53		Email notification delivered successfully.	admin_invitation	sent	email_outbox	\N	\N	\N	2026-10-25 03:09:57.993256+00	fozlerabbi.official.gmcservice@gmail.com	email	01a17109-4dab-7a33-826f-e2e24e909316	\N
54		[sensitive email payload omitted]	admin_invitation	sent	resend	\N	\N	\N	2026-10-25 03:12:00.817689+00	motinmirsagor@gmail.com	email	01a1710b-2e57-7a47-85d3-e764110c4ff8	\N
55		Email notification delivered successfully.	admin_invitation	sent	email_outbox	\N	\N	\N	2026-10-25 03:12:01.040672+00	motinmirsagor@gmail.com	email	01a1710b-2e57-7a47-85d3-e764110c4ff8	\N
56		[sensitive email payload omitted]	admin_invitation	sent	resend	\N	\N	\N	2026-10-25 03:14:35.278891+00	motinmir.vision@gmail.com	email	01a1710d-89bd-7c96-9597-a1d32a3f1e94	\N
57		Email notification delivered successfully.	admin_invitation	sent	email_outbox	\N	\N	\N	2026-10-25 03:14:35.500344+00	motinmir.vision@gmail.com	email	01a1710d-89bd-7c96-9597-a1d32a3f1e94	\N
58		[sensitive email payload omitted]	admin_login_alert	sent	resend	\N	\N	\N	2026-10-25 03:15:19.213586+00	faznetwork.com@gmail.com	email	01a1710e-355b-7f0d-a37c-3f99ecefe900	\N
59		Email notification delivered successfully.	admin_login_alert	sent	email_outbox	\N	\N	\N	2026-10-25 03:15:19.430352+00	faznetwork.com@gmail.com	email	01a1710e-355b-7f0d-a37c-3f99ecefe900	\N
60	01710415717	আসসালামু আলাইকুম গ্রাহক, FAZ NETWORK Hotspot account তৈরি হয়েছে।\nUsername: HN-6C982EA2A981\nPassword/PIN: 736387\nPackage: 12-Hour\nপ্রথম লগইনে ডিভাইস bind হবে এবং মেয়াদ শুরু হবে।	welcome	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 04:14:58.41915+00	01710415717	sms	\N	hotspot
61	01710415717	FAZ NETWORK Voucher\nPackage: 12-Hour\nVoucher PIN: 841883\nValidity: 12h (starts at first login).	welcome	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 10:20:23.50544+00	01710415717	sms	\N	hotspot
62	01710415717	FAZ NETWORK Hotspot Voucher\nPackage: 12-Hour\nUsername/PIN: HIZT67QF\nPassword: LFKU1XMK\nValidity: 12h\nCustomer: Faz Network\nThank you, FAZ NETWORK.	welcome	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 11:53:23.742924+00	01710415717	sms	\N	hotspot
63	01710415717	FAZ NETWORK Hotspot Voucher\nPackage: 12-Hour\nUsername/PIN: LVD79GSK\nPassword: K0ZJLWA5\nValidity: 12h\nCustomer: গ্রাহক\nThank you, FAZ NETWORK.	welcome	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 12:52:41.594481+00	01710415717	sms	\N	hotspot
64	8801710415717	FAZ NETWORK Hotspot Voucher\nPackage: 12-Hour\nUsername/PIN: LVD79GSK\nPassword: K0ZJLWA5\nValidity: 12h\nCustomer: গ্রাহক\nThank you, FAZ NETWORK.	hotspot_voucher_created	sent	baileys	\N	\N	\N	2026-10-25 12:52:42.428245+00	8801710415717	whatsapp	3EB06401AB0CC738B8D32F	hotspot
65	01710415717	FAZ NETWORK Hotspot Voucher\nPackage: 5M\nUsername/PIN: JVZYXL1I\nPassword: R72ZOK5V\nValidity: 5m\nCustomer: Rabbi\nThank you, FAZ NETWORK.	welcome	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 13:45:06.197333+00	01710415717	sms	\N	hotspot
66	8801710415717	FAZ NETWORK Hotspot Voucher\nPackage: 5M\nUsername/PIN: JVZYXL1I\nPassword: R72ZOK5V\nValidity: 5m\nCustomer: Rabbi\nThank you, FAZ NETWORK.	hotspot_voucher_created	sent	baileys	\N	\N	\N	2026-10-25 13:45:06.999963+00	8801710415717	whatsapp	3EB01434C91C803C5904F0	hotspot
67	01770708734	Dear Tonmoy Debnath, payment of Tk 500 received successfully via cash. TrxID: CASH-1792936644960-32. Your line is active till 2026-11-25. Thank you, FAZ NETWORK.	payment_receipt	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 13:57:26.044193+00	01770708734	sms	\N	pppoe
68	8801770708734	Dear Tonmoy Debnath,\n\nYour 45 Mbps subscription is renewed until 2026-11-25.\n\nUsername: 1011\n\nAmount Paid: 500 BDT\n\nFor support, call 013399-32887 or visit faznetwork.com.	renewal	sent	baileys	\N	\N	\N	2026-10-25 13:57:26.793988+00	8801770708734	whatsapp	3EB03F7F344E625BF8FAAB	pppoe
69	01710415717	Dear 01710415717, your internet connection has expired. Please recharge via bKash/Nagad to reactivate your internet immediately. Helpline: 01339932887	line_expiry	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 14:11:49.118296+00	01710415717	sms	\N	hotspot
70	8801710415717	Dear 01710415717, your internet connection has expired. Please recharge via bKash/Nagad to reactivate your internet immediately. Helpline: 01339932887	hotspot_expired	failed	baileys	\N	\N	WhatsApp is not linked. Open Notification Hub and connect the WhatsApp device first.	2026-10-25 14:11:49.394219+00	8801710415717	whatsapp	\N	hotspot
71	01710415717	FAZ NETWORK Hotspot Voucher\nPackage: 5M\nUsername/PIN: 2L3A3ZJK\nPassword: M2NUWEV6\nValidity: 5m\nCustomer: Faz Network\nThank you, FAZ NETWORK.	welcome	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 14:14:00.616386+00	01710415717	sms	\N	hotspot
72	8801710415717	FAZ NETWORK Hotspot Voucher\nPackage: 5M\nUsername/PIN: 2L3A3ZJK\nPassword: M2NUWEV6\nValidity: 5m\nCustomer: Faz Network\nThank you, FAZ NETWORK.	hotspot_voucher_created	sent	baileys	\N	\N	\N	2026-10-25 14:14:01.403176+00	8801710415717	whatsapp	3EB097AC04676F75A4CCBE	hotspot
73	01792954059	FAZ NETWORK Hotspot Voucher\nPackage: 30-Day\nUsername/PIN: PXNPLZAT\nPassword: 04J637WZ\nValidity: 30d\nCustomer: Edris Ali\nThank you, FAZ NETWORK.	welcome	skipped	disabled	POST_JSON	\N	sms_gateway_disabled	2026-10-25 15:12:42.135086+00	01792954059	sms	\N	hotspot
74	8801792954059	FAZ NETWORK Hotspot Voucher\nPackage: 30-Day\nUsername/PIN: PXNPLZAT\nPassword: 04J637WZ\nValidity: 30d\nCustomer: Edris Ali\nThank you, FAZ NETWORK.	hotspot_voucher_created	sent	baileys	\N	\N	\N	2026-10-25 15:12:43.172341+00	8801792954059	whatsapp	3EB0DE2C4C7C52CE3FAE60	hotspot
\.


ALTER TABLE public.sms_delivery_logs ENABLE TRIGGER ALL;

--
-- Data for Name: sms_notification_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.sms_notification_log DISABLE TRIGGER ALL;

COPY public.sms_notification_log (event_key, event_type, username, phone, status, created_at, sent_at) FROM stdin;
expiry_warning:pppoe:10009:Thu Oct 22	expiry_warning	10009	01774036879	sent	2026-10-19 18:51:08.635642+00	2026-10-19 18:51:10.100229+00
expiry_warning:pppoe:1010:Thu Oct 22	expiry_warning	1010	01332081110	sent	2026-10-19 18:51:10.173124+00	2026-10-19 18:51:11.540364+00
expiry_warning:pppoe:1011:Thu Oct 22	expiry_warning	1011	01770708734	sent	2026-10-19 18:51:11.612491+00	2026-10-19 18:51:12.998856+00
expiry_warning:pppoe:muslim1234:Thu Oct 22	expiry_warning	muslim1234	01723250330	sent	2026-10-19 18:51:13.071269+00	2026-10-19 18:51:14.406647+00
expiry_warning:hotspot:ee:5b:19:b2:22:ec:Fri Oct 23	expiry_warning	EE:5B:19:B2:22:EC	01999999999	sent	2026-10-20 18:27:10.718607+00	2026-10-20 18:27:12.385652+00
\.


ALTER TABLE public.sms_notification_log ENABLE TRIGGER ALL;

--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.support_tickets DISABLE TRIGGER ALL;

COPY public.support_tickets (id, title, description, category, status, priority, customer_username, assigned_to_user_id, created_by, created_at, updated_at) FROM stdin;
1	fdzbgf	rfdgb	general	open	normal	rfdsgfdg	\N	gmcproject	2026-10-10 15:48:20.354102+00	2026-10-10 15:48:20.354102+00
\.


ALTER TABLE public.support_tickets ENABLE TRIGGER ALL;

--
-- Data for Name: system_server_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.system_server_settings DISABLE TRIGGER ALL;

COPY public.system_server_settings (id, setting_key, setting_value, description, is_secret, updated_at, updated_by) FROM stdin;
1	android_sms_gateway_token_hash	d4d192bf76a64a4cfc84d486b78cb09086875497c0285c47cd355e8d9276ac61	\N	t	2026-10-19 22:00:07.41081+00	\N
2	master_webhook_token_hash	e88a73f8bef1afb600711a640ddd3a6be51bc6074b0cffcec0c4d87bcc4182fb	\N	t	2026-10-19 22:00:38.867701+00	\N
\.


ALTER TABLE public.system_server_settings ENABLE TRIGGER ALL;

--
-- Data for Name: webhook_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.webhook_settings DISABLE TRIGGER ALL;

COPY public.webhook_settings (id, secret_key, sender_ids, recipient_numbers, updated_at, updated_by) FROM stdin;
1	f23378d42852e3a1eaa6e52e2bba432dbf9f4765edb6b699e2664a0bd008849c	{"upay": ["upay", "16268"], "bkash": ["bkash", "16247"], "nagad": ["nagad", "16167"], "rocket": ["rocket", "16216", "dbbl"]}	{"upay": "", "bkash": "01339932887", "nagad": "01339932887", "rocket": ""}	2026-10-23 00:33:19.777192+00	admin
\.


ALTER TABLE public.webhook_settings ENABLE TRIGGER ALL;

--
-- Data for Name: whatsapp_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.whatsapp_sessions DISABLE TRIGGER ALL;

COPY public.whatsapp_sessions (key, value, updated_at) FROM stdin;
key:session:8801767094042.0	{"version": "v1", "_sessions": {"BQtCtqD2YQk+3yy5MTRZEOYnLrV1UTwveWg1HMJ3zw9e": {"_chains": {"Be7Ppaa7fog5/YQYgqgYYRosTMxjiJq+shMyEO/Nv4h9": {"chainKey": {"key": "NX9HWCpOX0ai1VkJwSDzvTM9oxqcFp2LVPmNvoP2Z1A=", "counter": 0}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792588060522, "closed": -1, "baseKey": "BQtCtqD2YQk+3yy5MTRZEOYnLrV1UTwveWg1HMJ3zw9e", "created": 1792588060522, "baseKeyType": 1, "remoteIdentityKey": "BX1Gfc6OQ/T8KE0+UcTlI0zjNUvyzeGWocgsG5xRDdYX"}, "pendingPreKey": {"baseKey": "BQtCtqD2YQk+3yy5MTRZEOYnLrV1UTwveWg1HMJ3zw9e", "preKeyId": 12287778, "signedKeyId": 15849268}, "currentRatchet": {"rootKey": "K59kL4TrlRLazSWcaOIqy2gqPDoBSMKF6ADlnMUl0JM=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "Be7Ppaa7fog5/YQYgqgYYRosTMxjiJq+shMyEO/Nv4h9", "privKey": "gD/8J70RFFqBorGTbFmPoTV+7obqTwb5AWLBEIapsms="}, "lastRemoteEphemeralKey": "BeK3VD4ghx/aBKu0haWyh2aptthiEC8DR2i0fWQtlLYZ"}, "registrationId": 397830260}}}	2026-10-21 13:07:40.640829+00
key:session:8801774036879.0	{"version": "v1", "_sessions": {"BdCKD4ELKpslGMjT0l714WvaQMA/YyB1P3R78lN+W4oo": {"_chains": {"BQFSytJMm1tn3l83ugoCB7e5Dh32RMSXqXGmlEFlfDA1": {"chainKey": {"key": "w1e6cugHMtPMS3UGim1REsKd4sI1UQ41ziFgdm6EXHs=", "counter": 0}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792608870871, "closed": -1, "baseKey": "BdCKD4ELKpslGMjT0l714WvaQMA/YyB1P3R78lN+W4oo", "created": 1792608870871, "baseKeyType": 1, "remoteIdentityKey": "BVIr76JueWiK4pn0ZfmxTozFXfUe7TymqyE5hXkdxnFJ"}, "pendingPreKey": {"baseKey": "BdCKD4ELKpslGMjT0l714WvaQMA/YyB1P3R78lN+W4oo", "preKeyId": 15517344, "signedKeyId": 2400677}, "currentRatchet": {"rootKey": "+4i1e+0P73liNuZlRmYmfSIFZQAPFoLZEcFudOSMTWE=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQFSytJMm1tn3l83ugoCB7e5Dh32RMSXqXGmlEFlfDA1", "privKey": "iBvvaQftSgvsoyzLkREPR2pnKf4VaGsTZ5ZPqa29eXw="}, "lastRemoteEphemeralKey": "Ba06WWXLInHbnq9CjmQUyeWKQHX4i61D01rhYptLMkBu"}, "registrationId": 125306202}}}	2026-10-21 18:54:30.989276+00
key:session:8801774036879.6	{"version": "v1", "_sessions": {"BazgaNmcCP0TDwh0GtoHzIG6EBEUHu6qvwCRm/RVjedR": {"_chains": {"BctUSX/lrmFW7osQVanRuD6c7HZGBGLarkz8oMaTe4RB": {"chainKey": {"key": "9+Q75E38O7FVqHhIdB7uVuli4igLQxRPXS8GoUiWS1w=", "counter": 0}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792608870873, "closed": -1, "baseKey": "BazgaNmcCP0TDwh0GtoHzIG6EBEUHu6qvwCRm/RVjedR", "created": 1792608870873, "baseKeyType": 1, "remoteIdentityKey": "BUADAtTfzzm/usVZXEqAf3fqBDNgRrpa7yftU8P3CL4n"}, "pendingPreKey": {"baseKey": "BazgaNmcCP0TDwh0GtoHzIG6EBEUHu6qvwCRm/RVjedR", "preKeyId": 1260, "signedKeyId": 3}, "currentRatchet": {"rootKey": "CntCta3HE/XeLDqkkO8rXmIvIKOYgXJkLifeWvJ20Xk=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BctUSX/lrmFW7osQVanRuD6c7HZGBGLarkz8oMaTe4RB", "privKey": "4IYD0tvQet26h1DuzApG2pAUiuCaRXbNrkA98TFa52A="}, "lastRemoteEphemeralKey": "BZIgspfZMZ49PqwuQcfwp4BX/8DgJdk/PF28snDvuChO"}, "registrationId": 6685}}}	2026-10-21 18:54:30.989276+00
key:session:8801792954059.0	{"version": "v1", "_sessions": {"BSBa/NOIEOFjBdJGo0nw7N4+/bFRs6ozGPawQaLCKWsB": {"_chains": {"BfgAl2P2PCHyCFm0ewyOWgQ1NFoTsnnSXn4zfKY7kTNQ": {"chainKey": {"key": "wNCo7erb/EFrf9b2gla9bVxbL6XR+cbn18a7HHtNdUk=", "counter": 0}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792941162759, "closed": -1, "baseKey": "BSBa/NOIEOFjBdJGo0nw7N4+/bFRs6ozGPawQaLCKWsB", "created": 1792941162759, "baseKeyType": 1, "remoteIdentityKey": "BWi8hLH8HOOC1Zy2lQKBadMZEVblPNr9H5kcjxyykB4d"}, "pendingPreKey": {"baseKey": "BSBa/NOIEOFjBdJGo0nw7N4+/bFRs6ozGPawQaLCKWsB", "preKeyId": 434, "signedKeyId": 3798806}, "currentRatchet": {"rootKey": "PrkpqfbFetlgME1eH36+pcqF00H9M+d+P4ciyr7MiCk=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BfgAl2P2PCHyCFm0ewyOWgQ1NFoTsnnSXn4zfKY7kTNQ", "privKey": "+ICDHYy+iZ/MW2qBH6251y8tlV6LaKniJerIKHyJH0c="}, "lastRemoteEphemeralKey": "BVnIYQxhm4MAhNACXBBSwTi5XzvHW/UohRADnpGDl498"}, "registrationId": 1409950475}}}	2026-10-25 15:12:42.874799+00
key:session:8801770708734.0	{"version": "v1", "_sessions": {"BQEEYFBy5I2aa0IFWrRYX1jdIBLhGIH3k8WvJzu5lx51": {"_chains": {"BUI/JUNKPlQxCF6uYJiC1q1DeeZdJrvrldiegU8FoicK": {"chainKey": {"key": "nee5k8A+Gn5EyMRLBt3jHGszztSJ/cgZbtlUOwyEtso=", "counter": 1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792608876591, "closed": -1, "baseKey": "BQEEYFBy5I2aa0IFWrRYX1jdIBLhGIH3k8WvJzu5lx51", "created": 1792608876591, "baseKeyType": 1, "remoteIdentityKey": "BWNRvbkXPtQ3Y1HYG60zw+9ZJ+Uelc2xaQ3aiqbmBKFL"}, "pendingPreKey": {"baseKey": "BQEEYFBy5I2aa0IFWrRYX1jdIBLhGIH3k8WvJzu5lx51", "preKeyId": 12622292, "signedKeyId": 5422325}, "currentRatchet": {"rootKey": "TVMXzExwEJ7gI/cakpbF0G4s3zbPPmQFMv3dRJckNQs=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BUI/JUNKPlQxCF6uYJiC1q1DeeZdJrvrldiegU8FoicK", "privKey": "AOsSDINxgsMJDXjB30Lyf02yV5xaCo/kxDpqosbtiXE="}, "lastRemoteEphemeralKey": "BdJoyEQNoMNseWaiLUtSJUoGCCJtNZEo5oP4Hw3cIq5b"}, "registrationId": 1438115578}}}	2026-10-25 13:57:26.417973+00
key:session:8801999999999.0	{"version": "v1", "_sessions": {"BRx4zIozz3aX+1/pp8qpNkPiNmnHLDN9PZENNAGEvXRy": {"_chains": {"Bf7u1z0Bfmb/41oRDo5NqqK1PAtvtO4ZbxvJ2NBYMcQD": {"chainKey": {"key": "eLTU/pnxZOEDEAYMH3Ex91uFjt9iucJzNSyMam9mNPA=", "counter": 2}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792520831975, "closed": -1, "baseKey": "BRx4zIozz3aX+1/pp8qpNkPiNmnHLDN9PZENNAGEvXRy", "created": 1792520831975, "baseKeyType": 1, "remoteIdentityKey": "BV/U6twX8mIn6ShC9GarsgNxwXAK9SbLh1hpN8VNHakZ"}, "pendingPreKey": {"baseKey": "BRx4zIozz3aX+1/pp8qpNkPiNmnHLDN9PZENNAGEvXRy", "signedKeyId": 3608835}, "currentRatchet": {"rootKey": "BaJd4QekTnmXw87BzsaoecOkcueNIFNwu8ouGiaWt8g=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "Bf7u1z0Bfmb/41oRDo5NqqK1PAtvtO4ZbxvJ2NBYMcQD", "privKey": "qDIs33GLth8AnhWzTmCCoKBtpXT2TIPb4p/Of8PUlU8="}, "lastRemoteEphemeralKey": "BeUJYn1kfwzTlrzRd9VzdQFcGSVHB7ZzPHUjb7zQBEcP"}, "registrationId": 87494915}}}	2026-10-23 13:01:18.354476+00
key:pre-key:33	{"public": {"data": "1ykuT9NR397Nay/oDYfeH5URg5+BnRcE4+YnRaq2vj8=", "type": "Buffer"}, "private": {"data": "EOmins0rnoPzcoD+6y9ibAtYuKqUkvnsaUQxRs3rVl0=", "type": "Buffer"}}	2026-10-26 06:34:22.091667+00
key:session:8801332081110.0	{"version": "v1", "_sessions": {"Baynecv/4Spqq7smpzrcMvc4Np8XHYMjl6nl/LGKo3pa": {"_chains": {"BUecRAJMrRZPBqRcnUuz3M1GTXdPMTprP+K0oE0wPHVN": {"chainKey": {"key": "E8EfF2A4quK/YGuYhCbrkW/OXW0MmyjfqZKd0S1nnkw=", "counter": 0}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792593911492, "closed": -1, "baseKey": "Baynecv/4Spqq7smpzrcMvc4Np8XHYMjl6nl/LGKo3pa", "created": 1792593911492, "baseKeyType": 1, "remoteIdentityKey": "BQws9RSnOQ1I6NtGb5Cr1x1TqlF1+Z7dVTOgpImxF689"}, "pendingPreKey": {"baseKey": "Baynecv/4Spqq7smpzrcMvc4Np8XHYMjl6nl/LGKo3pa", "preKeyId": 9118837, "signedKeyId": 7145268}, "currentRatchet": {"rootKey": "5vSHFIS6A5VzhA7L4FOwh0b0QmbOGXhFF6pC15dt6l8=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BUecRAJMrRZPBqRcnUuz3M1GTXdPMTprP+K0oE0wPHVN", "privKey": "2JoMsdppJSB4+U6fHff+5Jsvd4M4PYIFNMbqyMtOtXY="}, "lastRemoteEphemeralKey": "BfhKaYF7GaQ2yRmR5Oegv5W6scb06yAh3d+vqPDUZBUx"}, "registrationId": 1544744017}}}	2026-10-21 14:45:11.61237+00
key:session:8801723250330.0	{"version": "v1", "_sessions": {"BV5yIUwND2nYnlHT0g8f+35BIxQVwZRX5YfeNug4EToq": {"_chains": {"BbOxcW2WsS44LHy+q1fGgv7fDKv+e/BpTvYe2sQh0mRB": {"chainKey": {"key": "2W6zhDuxixA/n+gsJFzNY0ejq+qt3rd0+Z9dM+/n1vg=", "counter": 1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792608873668, "closed": -1, "baseKey": "BV5yIUwND2nYnlHT0g8f+35BIxQVwZRX5YfeNug4EToq", "created": 1792608873668, "baseKeyType": 1, "remoteIdentityKey": "BYVLuJImLRjXFF6xhRa6JB1R0WGW+guACQFc8k2z0noT"}, "pendingPreKey": {"baseKey": "BV5yIUwND2nYnlHT0g8f+35BIxQVwZRX5YfeNug4EToq", "preKeyId": 12036876, "signedKeyId": 16750557}, "currentRatchet": {"rootKey": "Kx+c/Tp+eUinDet52k+RWtVyYd8DU6hkHL/tkZ6QEXw=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BbOxcW2WsS44LHy+q1fGgv7fDKv+e/BpTvYe2sQh0mRB", "privKey": "4H2wJbO6p1dm4EwKQDUrZsVPG70vZ0TOJIIAv+kSVUk="}, "lastRemoteEphemeralKey": "BRV4HGIORWXam84hCgbCYm77n8Y65ezHRneJp6fpjjlf"}, "registrationId": 1812709238}}}	2026-10-22 07:53:49.481738+00
key:sender-key:120363428901335235@g.us::93230989336686::39	{"data": "W3sic2VuZGVyS2V5SWQiOjc3ODkwODczLCJzZW5kZXJDaGFpbktleSI6eyJpdGVyYXRpb24iOjQsInNlZWQiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOlszNiw4NSwyNDQsNTIsOTAsMjM0LDE2MSwxMTMsMTEwLDI1Myw0MSwxMjgsMTQ4LDIwMywxMzgsMTczLDE3LDQ1LDE2NCwxNTEsMTg5LDIwMSwxODQsMjgsMTczLDIwMiw4NiwyMTcsMTQyLDY3LDEyNSwxNjldfX0sInNlbmRlclNpZ25pbmdLZXkiOnsicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjpbNSwyNTMsNDAsMTk1LDE4OSwxNjcsMzMsMywxNjksNDMsMjQ4LDIyNCwzMSw3OCwxMzEsMjEyLDEzNSwxOTQsMjE0LDc3LDczLDEzNyw1OCwxNjQsMTMwLDY0LDE3NSwyMjMsMTk5LDkzLDU3LDg2LDU5XX19LCJzZW5kZXJNZXNzYWdlS2V5cyI6W119XQ==", "type": "Buffer"}	2026-10-22 12:28:18.14573+00
key:session:8801305155068.25	{"version": "v1", "_sessions": {"BZ5a3kv3/dnMjTrNrTJOfJQRZWI4QDICNiIlRUTrel1P": {"_chains": {"BYQx27TMtFTSiNYvWlZ5nRW6x/EhSKrgQl+mt6biK9Zf": {"chainKey": {"key": "PUlRKxzcGPt1P4lbMN9pvh2PuadcY2/FUzZ0KmtLT1w=", "counter": 1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792732490878, "closed": -1, "baseKey": "BZ5a3kv3/dnMjTrNrTJOfJQRZWI4QDICNiIlRUTrel1P", "created": 1792732490878, "baseKeyType": 1, "remoteIdentityKey": "BZGbKiLYmW9/CP8ITq8xnYqxX8Pg+cZ/qwk6E5vHDEpd"}, "pendingPreKey": {"baseKey": "BZ5a3kv3/dnMjTrNrTJOfJQRZWI4QDICNiIlRUTrel1P", "preKeyId": 1246, "signedKeyId": 2}, "currentRatchet": {"rootKey": "Wd2p8Mf0yvc3pw1tpAWUhrq8tZnW1ntLw8+iu9hYmAo=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BYQx27TMtFTSiNYvWlZ5nRW6x/EhSKrgQl+mt6biK9Zf", "privKey": "2D3aUHmcKkrCTm/9qkyMaLo4Ko10TQSAL8lXVTGXdmU="}, "lastRemoteEphemeralKey": "BeBX+7nEUps2cZbQmEjOvZoRj27LqtQaF0wrz2vayYA3"}, "registrationId": 3297}}}	2026-10-23 05:25:30.851907+00
key:session:8801770708734.14	{"version": "v1", "_sessions": {"BULHxTPQv/CZ8cni7DUnnVh3b9CK0qrMOn+SPC3gayhI": {"_chains": {"BadmHUCvf3BPHO+XZXgj7oGsNGb4wX7uNctk3cERQJ9T": {"chainKey": {"key": "ui/WasBGEPi0R8gxOZMI0q54qZeTJ9ciDW7T83KNzgw=", "counter": 1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792608876592, "closed": -1, "baseKey": "BULHxTPQv/CZ8cni7DUnnVh3b9CK0qrMOn+SPC3gayhI", "created": 1792608876592, "baseKeyType": 1, "remoteIdentityKey": "BZ5LTsUModgVXJwNBeBSEUPei9mlWOB1fiFrzBC/4KAE"}, "pendingPreKey": {"baseKey": "BULHxTPQv/CZ8cni7DUnnVh3b9CK0qrMOn+SPC3gayhI", "preKeyId": 5414, "signedKeyId": 3}, "currentRatchet": {"rootKey": "leDdDXSBztz3skYBB0+Ro7Mwn7fGIEeAFyOcavdVifg=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BadmHUCvf3BPHO+XZXgj7oGsNGb4wX7uNctk3cERQJ9T", "privKey": "cCEV2z54G2gkVFeVHTAXrotDNqcv1m2nB1/7yLzNW3k="}, "lastRemoteEphemeralKey": "BeDX5Pe9L+jbB32xBqIzY5NIA8MfBXS5EjiJ1BGdjRUT"}, "registrationId": 8048}}}	2026-10-25 13:57:26.417973+00
key:session:244934032498880.0	{"version": "v1", "_sessions": {"BfYpQwKAxcGa6bHi40ngOeUQeYY1yumUI0DSXo6gHDIQ": {"_chains": {"BQdrMtzMg0bb2XPRUkirO9FAEZCRKAbMmJyg5NJHdUtB": {"chainKey": {"key": "Ud2HYQv5U3BVXb72OYDQDtRAmBvo9HtKsxBD2uprIBc=", "counter": -1}, "chainType": 1, "messageKeys": {}}, "BcqZDojEf/t8FOQeJYOscZ3kr7+YpTB6ZWGADohCIhMF": {"chainKey": {"key": "8sL+Fmz+ubQvGOFKJyMvoKPy4E3O3l4WTQXv+6IZ7qY=", "counter": 4}, "chainType": 2, "messageKeys": {"3": "noP6E0xUqCNry0gN61cMhYvpT1l/GH0YYT7MV1ZioTE="}}}, "indexInfo": {"used": 1792821634067, "closed": -1, "baseKey": "BfYpQwKAxcGa6bHi40ngOeUQeYY1yumUI0DSXo6gHDIQ", "created": 1792821634067, "baseKeyType": 2, "remoteIdentityKey": "BfmMZScq7N3X6/7886DWe8g/9OlS+2yUMe/Vg2GFhrVN"}, "currentRatchet": {"rootKey": "i21e+NIXiCDIeIRZmUJQTfy5GRQuUpDnOLWGmmpEWx8=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQdrMtzMg0bb2XPRUkirO9FAEZCRKAbMmJyg5NJHdUtB", "privKey": "yMG0NxMykamsAEP2ltnDM1BMwk0dNHkP8iFqDIcV9m8="}, "lastRemoteEphemeralKey": "BcqZDojEf/t8FOQeJYOscZ3kr7+YpTB6ZWGADohCIhMF"}, "registrationId": 492564485}}}	2026-10-24 06:02:02.776034+00
key:session:8801743049190.0	{"version": "v1", "_sessions": {"BZVjLCopO2tw3V4v7aQczLlgvlKMavcaAEg8DOciJvJd": {"_chains": {"BQ/XDqLYwBCFrYTeChfK5utz2peI5skJZkQNH0uihIpQ": {"chainKey": {"key": "yjo910q2NeP7Zf+1NFoAWEUHKihfO9sav/UUmvlS98I=", "counter": 0}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792833234641, "closed": -1, "baseKey": "BZVjLCopO2tw3V4v7aQczLlgvlKMavcaAEg8DOciJvJd", "created": 1792833234641, "baseKeyType": 1, "remoteIdentityKey": "BT6aWwZsUflCoI1ooR/sl4T0eszDtLmZ+AQtQoE+t0gg"}, "pendingPreKey": {"baseKey": "BZVjLCopO2tw3V4v7aQczLlgvlKMavcaAEg8DOciJvJd", "preKeyId": 15504444, "signedKeyId": 5512278}, "currentRatchet": {"rootKey": "60aPFS0SmwILT7EmHB/PRYL1AouAl6giVoT83XREwO8=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQ/XDqLYwBCFrYTeChfK5utz2peI5skJZkQNH0uihIpQ", "privKey": "QLZE2lSJe7CdG9qqdIaeFzIk4zPLYe93UmIeREJIsF0="}, "lastRemoteEphemeralKey": "BZJCG7UrhEeubfZHjl59qbQh9X6moEsRrY58PU7HhuYx"}, "registrationId": 1972835090}}}	2026-10-24 09:13:54.756362+00
key:session:93230989336686.39	{"version": "v1", "_sessions": {"BQZmLjRBdXHGEkZ54GtfF839S36U59lpcAX+Q7ylfMts": {"_chains": {"BXcPwFQ7RGS4vJFtV+FWGPtYA+Vid8PqsWctFOn595Na": {"chainKey": {"key": "0bMjb28m5OLvKipa/vLMMk0qSr1ShI+7lHU+gCsp6lY=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792878741674, "closed": 1792879423712, "baseKey": "BQZmLjRBdXHGEkZ54GtfF839S36U59lpcAX+Q7ylfMts", "created": 1792878741674, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BQZmLjRBdXHGEkZ54GtfF839S36U59lpcAX+Q7ylfMts", "preKeyId": 171, "signedKeyId": 1}, "currentRatchet": {"rootKey": "6tGjAtvTS/8cw63xazHkcC9JVpGX7zhE77ghihPzEOI=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BXcPwFQ7RGS4vJFtV+FWGPtYA+Vid8PqsWctFOn595Na", "privKey": "8MiNFXc8Ix5QAbS78512IqoVI5iEDIti5JuSbZOxCUk="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BTC7UHMYorwJ2261QOeocghrYgPJeZ1YQeqgM74EKwI/": {"_chains": {"BQmDDIMvNdt+nZyHMhswHEaTU4q5OR4SGUyCaZrrhKkF": {"chainKey": {"key": "RfcClXVlxSP4R1zOzSkwVhY6gUJ55yUWhTGlbRQeuOs=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792670765843, "closed": 1792670766566, "baseKey": "BTC7UHMYorwJ2261QOeocghrYgPJeZ1YQeqgM74EKwI/", "created": 1792670765843, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BTC7UHMYorwJ2261QOeocghrYgPJeZ1YQeqgM74EKwI/", "preKeyId": 54, "signedKeyId": 1}, "currentRatchet": {"rootKey": "9YVlQtWi3WFTk1ZoO+hRug7zkGR/Y4BVYs0xpwJ+xz8=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQmDDIMvNdt+nZyHMhswHEaTU4q5OR4SGUyCaZrrhKkF", "privKey": "qFCNaAuTH4cKexO9bjkC+zQDipQEM+48R5SzSeNwlGU="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BTDN5Y40o2m4HNFgqKlkyMgxliA5n1SA4VEfZfwHZt4F": {"_chains": {"BQmWzT1tBMALKhhec9efIMUnhVIYUX+VPFrlVDEB1s4b": {"chainKey": {"key": "Uavzb/ZiyaCfTSzYc1bgBgQK8HiInpNqlM6e8YAfPOU=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792935909295, "closed": 1792937643576, "baseKey": "BTDN5Y40o2m4HNFgqKlkyMgxliA5n1SA4VEfZfwHZt4F", "created": 1792935909295, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BTDN5Y40o2m4HNFgqKlkyMgxliA5n1SA4VEfZfwHZt4F", "preKeyId": 193, "signedKeyId": 1}, "currentRatchet": {"rootKey": "wvvW9ajJnbdnouLJ+JVB1SdTjLZsxUxQ0E7s+BayKY4=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQmWzT1tBMALKhhec9efIMUnhVIYUX+VPFrlVDEB1s4b", "privKey": "GLnXQT0hmr6JzR+3bb6VBQkH3T8MhOtDva+wTNi/wk8="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BTQ4ktiaMK3TtZ2MI7S52+kUCJhhfIpd1eRsyd9cNsQt": {"_chains": {"BSmXE/QT3Xf0G1/nv4T8kh8TAUGYYC0mcxqDgy+TLLJD": {"chainKey": {"key": "JBggAycYFKy7gInGt1qPuSQBsumQWW7dSf3OIoxR6GM=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792937643500, "closed": -1, "baseKey": "BTQ4ktiaMK3TtZ2MI7S52+kUCJhhfIpd1eRsyd9cNsQt", "created": 1792937643500, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BTQ4ktiaMK3TtZ2MI7S52+kUCJhhfIpd1eRsyd9cNsQt", "preKeyId": 195, "signedKeyId": 1}, "currentRatchet": {"rootKey": "ES/EF+GQAP0FoHoL6K1S9ip8syL1XLeErnNY1QpZUp0=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BSmXE/QT3Xf0G1/nv4T8kh8TAUGYYC0mcxqDgy+TLLJD", "privKey": "YL4zLN64dZLYl3ncZ/85n5jaQsjuUdyzEMm2Ln7NGFY="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BVZpHvlvT75tWtIagirPo81T43crEY+xfnaUIQfXRVMT": {"_chains": {"BWUASrOxCWFeBmlnYc/Ojxswlo4wkCrd1Ah9LmhmHNhA": {"chainKey": {"key": "26h44eo/3gDNYEDmlhfvbz3Oiufx9WvlgE2+JH7E5iA=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792932763874, "closed": 1792935909372, "baseKey": "BVZpHvlvT75tWtIagirPo81T43crEY+xfnaUIQfXRVMT", "created": 1792932763874, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BVZpHvlvT75tWtIagirPo81T43crEY+xfnaUIQfXRVMT", "preKeyId": 191, "signedKeyId": 1}, "currentRatchet": {"rootKey": "/LNjYahMxbql9HLgJcPQGufnBJTbkEtI5QxL/24L9bA=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BWUASrOxCWFeBmlnYc/Ojxswlo4wkCrd1Ah9LmhmHNhA", "privKey": "ACTgKRo+ATEeBIj9csrEJlKECLBdgxdbK6LtVqHHV18="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BY5Rq2qhv/GIKmW/w9L8npmFUULUJo12YJjNZ+m2atlv": {"_chains": {"BRUAmAaEWrrBopQ4IWUEURmXCH8m3X6IPQMQoM1nhTYT": {"chainKey": {"key": "JuVZKEFNS2XKkzc4tJyU8ii9dTrhQ2Sxd3Xf/NZ2Z+Y=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792628806966, "closed": 1792670765288, "baseKey": "BY5Rq2qhv/GIKmW/w9L8npmFUULUJo12YJjNZ+m2atlv", "created": 1792628806966, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BY5Rq2qhv/GIKmW/w9L8npmFUULUJo12YJjNZ+m2atlv", "preKeyId": 19, "signedKeyId": 1}, "currentRatchet": {"rootKey": "F1HtKCgGcZYIHAWcC09iX7R1G2xip+StZlQSz5O28rg=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BRUAmAaEWrrBopQ4IWUEURmXCH8m3X6IPQMQoM1nhTYT", "privKey": "uIYyIFBDCUFJ/0IDhdp4PBXQXRsDP81ZwrZGJ8wvh24="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BYA1XjW0x+q649MG7lmRxM8OI1x1fiq8KNvTzC+eNIhJ": {"_chains": {"BbhEaBimDF0WrNdm6f+ROryeDh95ZNA+o58eBk7WNUJw": {"chainKey": {"key": "bL7eehUU+mDjtfS6Q56yMA25zYHNMRRyvYq53H42lJU=", "counter": -1}, "chainType": 1, "messageKeys": {}}, "Bey5n1uERly9pgVzaJPeBq94ccprynrJ9l6TE9TyKH1L": {"chainKey": {"key": "nWAiZ1VhPNI0iCcQd4eIt+g0bX1aJl7ft2msDU43DvA=", "counter": 3}, "chainType": 2, "messageKeys": {}}}, "indexInfo": {"used": 1792628201851, "closed": 1792628807039, "baseKey": "BYA1XjW0x+q649MG7lmRxM8OI1x1fiq8KNvTzC+eNIhJ", "created": 1792628201851, "baseKeyType": 2, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "currentRatchet": {"rootKey": "i7D+rfLCtOnTKUEq0e4DbnFSUqz868/VYOwcZrTaKDI=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BbhEaBimDF0WrNdm6f+ROryeDh95ZNA+o58eBk7WNUJw", "privKey": "+MnOmfn5h+z/fIkUoBCk1P0xTa1iQIg7HA9oTIspUn0="}, "lastRemoteEphemeralKey": "Bey5n1uERly9pgVzaJPeBq94ccprynrJ9l6TE9TyKH1L"}, "registrationId": 10852}, "BYJkLJ/fdifdkEQq2/xJ+5iSPRz7yEGkDUc+g6HHHdtb": {"_chains": {"BZ3QELi528A4G6MsZhLO85HMbrIhUVi3lOJj/1WT3Ygm": {"chainKey": {"key": "rfLfO9DZTlYXU3xu1R0ZVIvUWhtQ28+Ez5t+PmrILm8=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792877211929, "closed": 1792878741749, "baseKey": "BYJkLJ/fdifdkEQq2/xJ+5iSPRz7yEGkDUc+g6HHHdtb", "created": 1792877211929, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BYJkLJ/fdifdkEQq2/xJ+5iSPRz7yEGkDUc+g6HHHdtb", "preKeyId": 170, "signedKeyId": 1}, "currentRatchet": {"rootKey": "/wWokt3wgxasiNG36X67ucM+VbiLdBD/yyuvcD++8PY=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BZ3QELi528A4G6MsZhLO85HMbrIhUVi3lOJj/1WT3Ygm", "privKey": "YGMuwGuAt3B6TidFOCTIapOu+NAG8NaCibtc5he/hHM="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BYuQUrF6RlI7I+1qCS5DJXND9yYXs2p/FYA6aeOd1voE": {"_chains": {"BcBlzOtuQHMfxEsR0UvFBPI3z5P8gnxGFWGXBN16NbNo": {"chainKey": {"key": "HDqd14yUTzYfWzf7684HdWDU17rhzL7lcP3n3D6Zauc=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792887095042, "closed": 1792932763953, "baseKey": "BYuQUrF6RlI7I+1qCS5DJXND9yYXs2p/FYA6aeOd1voE", "created": 1792887095042, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BYuQUrF6RlI7I+1qCS5DJXND9yYXs2p/FYA6aeOd1voE", "preKeyId": 173, "signedKeyId": 1}, "currentRatchet": {"rootKey": "XgwEvsFlvRWhWigcLhSXoRdeEF8CPp4TBNxcM1LP6dg=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BcBlzOtuQHMfxEsR0UvFBPI3z5P8gnxGFWGXBN16NbNo", "privKey": "KPgvQhJ9WEzqBpJM2x2o0vfZFavJLfV46blESsP8Qlw="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "Bc9YIweVNM52f3o23dy073b8wfVHQDesurBZ540swvEJ": {"_chains": {"Baqtr5HdA7qVDag7VxcjD4MWOJoifbWEM2bnNMEeKyoF": {"chainKey": {"key": "uXOhXFBR3/YEiW8NxHSjxlrg+vmZEkza1ZqPWgr6hs0=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792879423637, "closed": 1792887095117, "baseKey": "Bc9YIweVNM52f3o23dy073b8wfVHQDesurBZ540swvEJ", "created": 1792879423637, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "Bc9YIweVNM52f3o23dy073b8wfVHQDesurBZ540swvEJ", "preKeyId": 172, "signedKeyId": 1}, "currentRatchet": {"rootKey": "OvJxFScPAwW/whPL7cFlBtQZlY9r4Rg4xcTpuCCN9Ks=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "Baqtr5HdA7qVDag7VxcjD4MWOJoifbWEM2bnNMEeKyoF", "privKey": "aKOt4z6gtPhnXKKOjW4qFVDhcfhZz13/AxH2R8DAhEI="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BcMuqilS1O2Fbuhj8NBOSGzRHLpWjuP5dTfjtbSMCdsB": {"_chains": {"BbWxWorBVKs/Q3WaES3VGQerd8GN+m9OpjU+NG3UDuli": {"chainKey": {"key": "dHb90TSD4S5xLAvVFTZywmpJP6Zmedaj5RWwehIOUpI=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792755177515, "closed": 1792877212007, "baseKey": "BcMuqilS1O2Fbuhj8NBOSGzRHLpWjuP5dTfjtbSMCdsB", "created": 1792755177515, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BcMuqilS1O2Fbuhj8NBOSGzRHLpWjuP5dTfjtbSMCdsB", "preKeyId": 103, "signedKeyId": 1}, "currentRatchet": {"rootKey": "dCb+UKirH1X2bw8nj/cXQ6q9LIWVE9GCo7KX3NuOAMM=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BbWxWorBVKs/Q3WaES3VGQerd8GN+m9OpjU+NG3UDuli", "privKey": "mPIiw2ShBMCM6xpFlYAK9ot7xOqcA7UcXXTCKEtDWUc="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "Bdo0K1Gzbu4Uj4InGdoanlbQE+9Op6Kow0MHmoe/zZwu": {"_chains": {"BWMm3kqNOmfcgnLwbhd4DCjeWGltnLQqRwD9eOZMnYR2": {"chainKey": {"key": "EQFSLTDlJL/E9RR0QcWe1vGvilUf+4h5/K4FBhN7J5A=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792670766486, "closed": 1792755177590, "baseKey": "Bdo0K1Gzbu4Uj4InGdoanlbQE+9Op6Kow0MHmoe/zZwu", "created": 1792670766486, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "Bdo0K1Gzbu4Uj4InGdoanlbQE+9Op6Kow0MHmoe/zZwu", "preKeyId": 55, "signedKeyId": 1}, "currentRatchet": {"rootKey": "PCi/5sWbNesXvvvm4lGeLj2nL6IMi5WltPNbiy8gh8Y=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BWMm3kqNOmfcgnLwbhd4DCjeWGltnLQqRwD9eOZMnYR2", "privKey": "SPcXy0PvYMqHxmkqKYHRpffmmcw4gOKz1qs7aIHHOk4="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BeiB1DaWDvg2GrYo5vc2YrU3LAJMIrkckyI8n02VQDx5": {"_chains": {"BZAp77jKEjTgmW636qchkjYagNo5ZbPri56et/cCl3ol": {"chainKey": {"key": "x5VzFdPtNCACg9W6/6gmaOijS+kbdEn5BsvzDgmw2DY=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792670764763, "closed": 1792670765917, "baseKey": "BeiB1DaWDvg2GrYo5vc2YrU3LAJMIrkckyI8n02VQDx5", "created": 1792670764763, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BeiB1DaWDvg2GrYo5vc2YrU3LAJMIrkckyI8n02VQDx5", "preKeyId": 53, "signedKeyId": 1}, "currentRatchet": {"rootKey": "3H+wsZAoOJ8yQrGpIC47Yd8Z71+qDj0GGcA09Kz1MVw=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BZAp77jKEjTgmW636qchkjYagNo5ZbPri56et/cCl3ol", "privKey": "eM7zjShKmJ55VznZjtCn8Z6s1SRFlkXjw0F0SB4ZvFE="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}, "BfyjfztBivzlqaD982p6D5kjlz1AJVN+//UeULtWMo8j": {"_chains": {"BR+LA02dBR26RY/oUyrq8RDyYA09HTxaA92r6tmHdX0r": {"chainKey": {"key": "1koyHpS6/yZ9S/qmi66PHFwZPlCHaZGDhscpepu3QEs=", "counter": 1}, "chainType": 2, "messageKeys": {}}, "BVQLqZRJ9PNCZGCQjbCqwhqnDbLc2Be8FuJNmfngV29G": {"chainKey": {"key": "q8gPB3jce9dNB8/gc2/ePlyLlS4zHxd5OTFEevBo/yk=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792622755520, "closed": 1792628201850, "baseKey": "BfyjfztBivzlqaD982p6D5kjlz1AJVN+//UeULtWMo8j", "created": 1792622755520, "baseKeyType": 2, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "currentRatchet": {"rootKey": "AztUJ+iDAKXBfqkLevnv1gT7b8ykHk6pYtTr4iQ8kCM=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BVQLqZRJ9PNCZGCQjbCqwhqnDbLc2Be8FuJNmfngV29G", "privKey": "KHnIDBcjbG+pCYlUMgNqu9+EcpjeTke+wKDNeVZ+7kw="}, "lastRemoteEphemeralKey": "BR+LA02dBR26RY/oUyrq8RDyYA09HTxaA92r6tmHdX0r"}, "registrationId": 10852}}}	2026-10-25 14:14:03.613835+00
key:session:8801305155068.0	{"version": "v1", "_sessions": {"BfWmSuyeoArCWk5EWgh5oiNH2Y6wD9LttxX9+7BJpWIk": {"_chains": {"Bd67WRxctSvTzFkl6jNzt1M8zW53oO4Lb+8mWYFbrGlM": {"chainKey": {"key": "hppmABmBqJ+uIR/6K0vgrcdoTo5OG6EoD6zLPWBGtnQ=", "counter": 1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792732490875, "closed": -1, "baseKey": "BfWmSuyeoArCWk5EWgh5oiNH2Y6wD9LttxX9+7BJpWIk", "created": 1792732490875, "baseKeyType": 1, "remoteIdentityKey": "BcY8AIBPGhbzlNYvUVN1E4QNi3A8q/nSHgKEsDSSgUNO"}, "pendingPreKey": {"baseKey": "BfWmSuyeoArCWk5EWgh5oiNH2Y6wD9LttxX9+7BJpWIk", "preKeyId": 3770924, "signedKeyId": 10838820}, "currentRatchet": {"rootKey": "dIU3E2Phhv3SuBPeqDTjJkgSNMTK21VWkxV5KGDTyi0=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "Bd67WRxctSvTzFkl6jNzt1M8zW53oO4Lb+8mWYFbrGlM", "privKey": "cETLyx1F4X4cidLC/jdS1PiFekRjFrEYsEEEMQs+5FU="}, "lastRemoteEphemeralKey": "BW4ZAsXq+GRJua6w1x2uZv58aZoycxDnLr/n49iZrdFM"}, "registrationId": 1798574121}}}	2026-10-23 05:25:30.851907+00
key:session:217549035798748.74	{"version": "v1", "_sessions": {"BQfBd1tDZQQ14FwWCokQ5WbMPxynugCo6zTXlM3uVTBH": {"_chains": {"BSK4JQyqSlAl/E9+LT+32PQgib31czFU7U3S3mSE3EQA": {"chainKey": {"key": "oUyVGox5RTmKIrJpaK4hoAO12vcbpIcUoQ/txjHaznM=", "counter": -1}, "chainType": 1, "messageKeys": {}}, "BWjnQYCm8Uh0rC824I1DQLuFcZHIJwZWHi6OGsQELbcO": {"chainKey": {"key": "8EY1ssDzj+ceUJHm9iyzKsCAEU++I0vzor0UwjdH7vU=", "counter": 0}, "chainType": 2, "messageKeys": {}}}, "indexInfo": {"used": 1792457742607, "closed": -1, "baseKey": "BQfBd1tDZQQ14FwWCokQ5WbMPxynugCo6zTXlM3uVTBH", "created": 1792457742607, "baseKeyType": 2, "remoteIdentityKey": "BUdOLJi0NvLPNeZS+m/6NvDQhdbs+SPbQkxLD4Z7CTRW"}, "currentRatchet": {"rootKey": "d2QbtvKIhEXjjsu/8yLVrVhe1zg4/tQgvEtd6CR3LUY=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BSK4JQyqSlAl/E9+LT+32PQgib31czFU7U3S3mSE3EQA", "privKey": "8DzcY9eSjGzzkWHNS64CoMFf4D5Bs6XXG6nCXUTRQF0="}, "lastRemoteEphemeralKey": "BWjnQYCm8Uh0rC824I1DQLuFcZHIJwZWHi6OGsQELbcO"}, "registrationId": 10866}}}	2026-10-20 00:55:42.64686+00
key:session:55573219393548.0	{"version": "v1", "_sessions": {"BRs4ubUnEp93rutlU86CXO3aoamkMd40nbkGSqrZhO9U": {"_chains": {"BW0uShtTUX9FCswq2JU0MqFLqa710Yq8an9H2Fr3ptE8": {"chainKey": {"key": "avI+y0bUg8yUUL/uHrDNy2gX+p+HItpbeyOt9rA1N4Y=", "counter": 1}, "chainType": 2, "messageKeys": {}}, "BeKlT9Jx326K5PZoRDK8hB/3du51tYl4+RSJEeprstEj": {"chainKey": {"key": "PEHlvPcjqUEcRLUKczzC78OA2GXZwQO7S+ksdz6Gkuo=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792996463841, "closed": -1, "baseKey": "BRs4ubUnEp93rutlU86CXO3aoamkMd40nbkGSqrZhO9U", "created": 1792996463841, "baseKeyType": 2, "remoteIdentityKey": "BWi8hLH8HOOC1Zy2lQKBadMZEVblPNr9H5kcjxyykB4d"}, "currentRatchet": {"rootKey": "qI+W5Hq8VX7yx0JqEe10DaE9S/8YCqJZK7JCsRQnuFg=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BeKlT9Jx326K5PZoRDK8hB/3du51tYl4+RSJEeprstEj", "privKey": "WBCLlnkS/zbz1WsSe4pKjBgdCJO7YUCwth9ybCXrXH0="}, "lastRemoteEphemeralKey": "BW0uShtTUX9FCswq2JU0MqFLqa710Yq8an9H2Fr3ptE8"}, "registrationId": 1409950475}}}	2026-10-26 13:38:46.656831+00
key:session:8801710415717.0	{"version": "v1", "_sessions": {"BbZ4zkrdAiDg6TF8SwSRwGaW1DakACJKoDfZm1ihy4UA": {"_chains": {"Ba1dHbiJO2X5JuewL6DaJtctzLvVPdke9sSEifGVbEs3": {"chainKey": {"key": "p4YYq+LXEv2AGBfxzlVQhZkNL3g0ItCljK9kzz/FnoA=", "counter": 12}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792627740928, "closed": -1, "baseKey": "BbZ4zkrdAiDg6TF8SwSRwGaW1DakACJKoDfZm1ihy4UA", "created": 1792627740928, "baseKeyType": 1, "remoteIdentityKey": "Bbal7UJpjJrvGigAUjE3shwfWUSQdu6AkkcB5I9psl9w"}, "pendingPreKey": {"baseKey": "BbZ4zkrdAiDg6TF8SwSRwGaW1DakACJKoDfZm1ihy4UA", "preKeyId": 4081461, "signedKeyId": 10020748}, "currentRatchet": {"rootKey": "wDA2rDZk4HC4nRVRTmYtcdRayagJoTGySHYmRMf4+JM=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "Ba1dHbiJO2X5JuewL6DaJtctzLvVPdke9sSEifGVbEs3", "privKey": "KKpZVHUoOV7QqIMUWtGQONzJJ9bg3V8czxXxlPiJ4lw="}, "lastRemoteEphemeralKey": "BUTipzgt1f8w0UZrDG3003uvOTT7RgE4Y2ERcfK9zPQb"}, "registrationId": 531312691}}}	2026-10-25 14:14:01.043033+00
key:session:8801814237287.0	{"version": "v1", "_sessions": {"BSuSHq09xhWmM11yNxJwCHQB9zQdIF99JcA+7X7OKVhh": {"_chains": {"BZkaTjB7g83nnKkrNrzB12SUurLNSviKBzOmernIcx1a": {"chainKey": {"key": "opw5Wi3D3L9fP1zhlW1XiyyBCJPikYG6M1t/492UqdM=", "counter": 0}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792634099105, "closed": -1, "baseKey": "BSuSHq09xhWmM11yNxJwCHQB9zQdIF99JcA+7X7OKVhh", "created": 1792634099105, "baseKeyType": 1, "remoteIdentityKey": "Ba5n9PwCUgEHiimXHMzK6/ebeCS5NP5NeUUybm7mbIUo"}, "pendingPreKey": {"baseKey": "BSuSHq09xhWmM11yNxJwCHQB9zQdIF99JcA+7X7OKVhh", "signedKeyId": 2155011}, "currentRatchet": {"rootKey": "yCNHuG307mS2JmVOB2+ZxmQ7AKVsbUlilnj04Y5ZDNk=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BZkaTjB7g83nnKkrNrzB12SUurLNSviKBzOmernIcx1a", "privKey": "WAU5jr2scOfJK/r/dzdEKC6HhuHx6Yqh2hY2ay6HRkw="}, "lastRemoteEphemeralKey": "BabMEIFByzFLeT+sQvG3p62tLI9U9XPyqqvqekObXLkl"}, "registrationId": 69263875}}}	2026-10-22 01:54:59.239544+00
key:session:8801710415717.39	{"version": "v1", "_sessions": {"BYX3cfnSIy1nWTWF30X+GMH/FdOR8HEMcTZRFft8Tqdd": {"_chains": {"BbxtZphkjEI+FWRujYHsR/3AY5amODVY5Aw4fag23CUn": {"chainKey": {"key": "IWHOgMhiYw4mdgx6dmKAdiKF/EWFiDQSWHdohkTetDs=", "counter": 12}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792627740929, "closed": -1, "baseKey": "BYX3cfnSIy1nWTWF30X+GMH/FdOR8HEMcTZRFft8Tqdd", "created": 1792627740929, "baseKeyType": 1, "remoteIdentityKey": "BVVjDETEw/mXtKOMaYza/R3/MrzwWQg8ySAxGQ95Zm5C"}, "pendingPreKey": {"baseKey": "BYX3cfnSIy1nWTWF30X+GMH/FdOR8HEMcTZRFft8Tqdd", "preKeyId": 18, "signedKeyId": 1}, "currentRatchet": {"rootKey": "QkhAf/LsWCnhjnETbyqcaw1z2OGNkAs+unh75fl3q8Q=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BbxtZphkjEI+FWRujYHsR/3AY5amODVY5Aw4fag23CUn", "privKey": "mJV8gKtID8zWdQsdr6vn/9REoC1mQHhVrI/6yXzYr0c="}, "lastRemoteEphemeralKey": "BYMcROEXMyz57DyRg7dWQzoUKHQqztgtMUe+e8cWRT8C"}, "registrationId": 10852}}}	2026-10-25 14:14:01.043033+00
key:session:8801339932887.0	{"version": "v1", "_sessions": {"BdMa3vwPINaA3agEImho7mhwb0cmfkdWb//mJ3/bPdcT": {"_chains": {"BW1TCp5bNs1dVUulqcps4HEqGVDyOoeP56DenJtOnV5S": {"chainKey": {"key": "LwOSJxkYgk+NYTPbNQ9v8PZgCEQBUzju/QWv0GhHTKk=", "counter": 50}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792457271934, "closed": -1, "baseKey": "BdMa3vwPINaA3agEImho7mhwb0cmfkdWb//mJ3/bPdcT", "created": 1792457271934, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BdMa3vwPINaA3agEImho7mhwb0cmfkdWb//mJ3/bPdcT", "preKeyId": 15921757, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "VPjOXAh7Hbih9eXvfwlB6Zg1EyMdygR1JytduNd847Q=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BW1TCp5bNs1dVUulqcps4HEqGVDyOoeP56DenJtOnV5S", "privKey": "yFD/pZZyvo46D7S0c4c1WB5AfY4LNV0uR712n/8pykU="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}}}	2026-10-26 13:39:39.249456+00
key:session:93230989336686.0	{"version": "v1", "_sessions": {"BWRa1nkgGQ+LfUX9PQMSnIdq+jd8vwEinCZ4+DeiX60U": {"_chains": {"BVTuBBelkHpvg9keFTG82y7ak6Nrz92E1pFttxyh6UEW": {"chainKey": {"key": "fHyeTlsTOWybS/iCfPOZ+Fank8nSztFUxlIWrjvrTNs=", "counter": 0}, "chainType": 2, "messageKeys": {}}, "BeCHO471f28rWNU/tErDzLDDsHMgUmYrkHURob4eGS5i": {"chainKey": {"key": "FmEZpJLZqV8xVbx8EYkCYHXXFBvaau5KayvswsZeoTE=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1793021982190, "closed": -1, "baseKey": "BWRa1nkgGQ+LfUX9PQMSnIdq+jd8vwEinCZ4+DeiX60U", "created": 1793021982190, "baseKeyType": 2, "remoteIdentityKey": "Bbal7UJpjJrvGigAUjE3shwfWUSQdu6AkkcB5I9psl9w"}, "currentRatchet": {"rootKey": "32zyC6J7Q1/vecqp4Tb12rxYtMWU1Bmx09FQTEQa9Hs=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BeCHO471f28rWNU/tErDzLDDsHMgUmYrkHURob4eGS5i", "privKey": "ABu0u0z02Ld1irdWHnAEtgtaYVQtlu12IOItDIe6nkg="}, "lastRemoteEphemeralKey": "BVTuBBelkHpvg9keFTG82y7ak6Nrz92E1pFttxyh6UEW"}, "registrationId": 531312691}}}	2026-10-26 13:39:42.228024+00
key:pre-key:3	{"public": {"data": "aL/2iHLda3BsN3lyKq1hDBsn7XUggke2AHIr19P83lQ=", "type": "Buffer"}, "private": {"data": "qJnPN7qw2kbol5+O/6U+f249mjRlPIg/FVsCYWtxVkY=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
creds	{"me": {"id": "8801339932887:13@s.whatsapp.net", "lid": "209264429822062:13@lid", "name": "Faz Network"}, "account": {"details": "CI6i3+wBEOSg2tYGGAEgACgA", "deviceSignature": "GaPswSjavepLP7JVjMAIfQ56q/0SNf5dnqH4L9JBI51l2eM4XUdcrub3LJt/gVGxvhsxdHw/bYtTDQzsr/y2iA==", "accountSignature": "JEVT2F6nFLSkqf1GB7a38Nn0LoQiqfplX2yZk6NSWQrr4RLwXCPvYaWPu4Auu1E1A7PtM3hHr8D0OLkSsUzBAQ==", "accountSignatureKey": "D+hBPLZPSRpTk2XKQxbyRrY4BIxZXD+BKokP8sbkOVE="}, "noiseKey": {"public": {"data": "2eUmlsISoMN0t3f9jJfczC/0HTvZZvfN98swzXooE2A=", "type": "Buffer"}, "private": {"data": "oIcofGX+Vktp8hyWvmIMmyu5e1EzVqdGRPmX+Vs3kG4=", "type": "Buffer"}}, "platform": "smba", "registered": true, "routingInfo": {"data": "CAUIDQgS", "type": "Buffer"}, "advSecretKey": "DOS0i+Ul2qgiEs4LjfzVYbT8JapT1BJvOkcwBsjIEjo=", "nextPreKeyId": 36, "signedPreKey": {"keyId": 1, "keyPair": {"public": {"data": "xr0EbHcroKr6aD3W078/Vxp+EpLqWl0hX4BTtbABBx8=", "type": "Buffer"}, "private": {"data": "EBb2ZNf9wz0d7sPgqSlJNdgIFjZ4klWSMOBIbD8IOUw=", "type": "Buffer"}}, "signature": {"data": "NEQk3/38Qy1SEsnrTgxGO1fxAk5+H4snhYHtDQEly3sbO0SgRY5rh6rrR2awnjih2yB0XpxUU2Iqgqartz6CgQ==", "type": "Buffer"}}, "registrationId": 114, "accountSettings": {"unarchiveChats": false}, "signalIdentities": [{"identifier": {"name": "8801339932887:13@s.whatsapp.net", "deviceId": 0}, "identifierKey": {"data": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR", "type": "Buffer"}}], "signedIdentityKey": {"public": {"data": "qi3+/fspVcSpDzRZR1lu4nomfDNoFDv0u0OXlLPypTU=", "type": "Buffer"}, "private": {"data": "gEUBgqji+l5obGFOLqSCvw2gdyNx/r+rM4CS5Rdve1I=", "type": "Buffer"}}, "accountSyncCounter": 0, "firstUnuploadedPreKeyId": 36, "pairingEphemeralKeyPair": {"public": {"data": "vO+J2BsjrHKpQYdTiV4J/D9PSapitOTJnFWDycHJ2X8=", "type": "Buffer"}, "private": {"data": "IBT5Z0r02SgcxlDTMBuI4/czVKxOWHgB86RAQBHMJnI=", "type": "Buffer"}}, "lastAccountSyncTimestamp": 1792980609, "processedHistoryMessages": []}	2026-10-26 17:48:55.824671+00
key:pre-key:6	{"public": {"data": "PFq7Jhk49eajgvZnUZNtK/PjBX5OLqEJptGEC6s2JmY=", "type": "Buffer"}, "private": {"data": "6Lcblr1up90ZKIIEibIXJBYNA79wAlUOfz9coCfzhlY=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:7	{"public": {"data": "u3oZEDdffgBhhNhOOFxinKxxjvcqSXnIfQLVCiOe4SM=", "type": "Buffer"}, "private": {"data": "8M9NSLOTIYZOGyE7N2V3KZt4UHIY1azUWiyMopM5h1Q=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:8	{"public": {"data": "ATXRMgB/bqPUfM9N2vT//0Ge0nMPvK55gR+7fctwwGY=", "type": "Buffer"}, "private": {"data": "sD2SlkDqi+tuCf6BrlPKHCCh0OIEpHBHzQKI4Bfc6Vc=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:9	{"public": {"data": "HbhPNYQxiRS2TlYlvmsJS27ZlXMPH5yjc8NzAiQkP38=", "type": "Buffer"}, "private": {"data": "iAeeqzmoKQnsB0mN+pa9pGFG6Zf+dJtLJiReH9+fx2c=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:10	{"public": {"data": "z46/X8iKH5wW16lBVEd4BR/o+/Ipmcqt+Aw541meal0=", "type": "Buffer"}, "private": {"data": "uLTYlbtkQ21OBOQLJs2Ts0GFqTUOgn/1rYnbc42G6VY=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:11	{"public": {"data": "6OWU/f4mWIM9pwMYX0UIlPVMTwHDntL9CGmJ0jg07E0=", "type": "Buffer"}, "private": {"data": "8OsI9a8y59z6fGot2y5wJzZm0yMY86JJNu41lVPfcXo=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:12	{"public": {"data": "YzYBwOVAZTAbH9K6M1qysFlxf1WXRW+k3sH3YZl3oWc=", "type": "Buffer"}, "private": {"data": "OHuUmUJC+1hKkzcIQ88dyuLWet15evUjVtxh85faZUY=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:13	{"public": {"data": "zIA2iRIV94L5z3ZORlO0Uv5N8crLfVXwuevviqL7J3Q=", "type": "Buffer"}, "private": {"data": "2LznbkFih8WnmZ5b5NvkHGqLZyWBdViiY8XS2HXZHF8=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:14	{"public": {"data": "i5Cv2ggZ0Z16sU8nMJLCcMJSIh32P/84dj+F89D2HDc=", "type": "Buffer"}, "private": {"data": "mCGGyvgKnlCwEsGcbd29m9KrwO40SWkXkx3flsaUQlA=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:15	{"public": {"data": "mMqC1Ew+LNkuqx4Au7QaeIljpGOYTmwQxmBi+oaZslc=", "type": "Buffer"}, "private": {"data": "IMeK4mNmJP2BxYybMwBK7+PYxay7BOvCLOK+5O0mpU0=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:16	{"public": {"data": "MWhl+TdEhLjjVirSzVx3XQZV0FfwZjmMxG1rQ+YeYDw=", "type": "Buffer"}, "private": {"data": "wFMB1FpPjXZ0KRC3J+WAMgbCGOja4ySp++xm5Rre03E=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:17	{"public": {"data": "UL6xwMXgWKfB+HjMNkwTH5WdU7wINvM+lmfCzsefLgo=", "type": "Buffer"}, "private": {"data": "SI4lPoB58JFNQEH8GsvryykQ5sQHisZetuw87oW1M0s=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:18	{"public": {"data": "6TwhwR2LvwTZtxF6D8psEAYfrEtwN7yRnc3E1K+K5XA=", "type": "Buffer"}, "private": {"data": "uKp1NB5tL/cP6CRGea88sQBoLOsS1DFJRCZROzvEBGU=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:19	{"public": {"data": "Znpw02rHwzrQCZBN//QClCj6kLqsGpUJLxMY34DVFVk=", "type": "Buffer"}, "private": {"data": "8OY7WU22a7BLS12RPXiq17zwWCo4IsoMecbDPxGFgnY=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:20	{"public": {"data": "8KGkQDdIaJNJlgn55l1uN2qlViHjYC5oM8MW8rafaS4=", "type": "Buffer"}, "private": {"data": "GPt87LZtywAMGJXHFzJ1URxS2RtKyiYd2sIulzSW81U=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:21	{"public": {"data": "Bnx3y4lX+ysLKlYjLoCpoSkzV1rSMk+ditAUdqlRIlw=", "type": "Buffer"}, "private": {"data": "sHDEELPNT2BQwiszZdz5QhVHZS5xKU7Nfb5U+t62uEQ=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:22	{"public": {"data": "zQs/lQHzqfnMYLAwQUY+C/p85MHyDSku9toJzqISDQ0=", "type": "Buffer"}, "private": {"data": "0NQ27a9orjXs8u2gXeUt3y8/ke6I/dhXQgyKfFLW8nk=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:23	{"public": {"data": "lLGfR22sMGDg5KObuwSu580avqIKc7CnFY38ZT1KhEI=", "type": "Buffer"}, "private": {"data": "2JrKcN2ttOeGvRsF0OjGFZ47T1IofahIa1j68N6rJXM=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:24	{"public": {"data": "Fexjj0NTeGTvOgKze9TL4jsig0QwbAx5uxAv/xNggCY=", "type": "Buffer"}, "private": {"data": "+OTfmeSLAhn0izw9e2vjXBPoXKunegMmSCPWlTfbpmA=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:25	{"public": {"data": "LNlDINVUwNVhwpazFHipmK/GGksRRKLxG2lQAOc+5wA=", "type": "Buffer"}, "private": {"data": "wP/K1Hw4siKj0KcTL6BA9fXr4E+A2cTZTLa5lk8vBWk=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:26	{"public": {"data": "af36y10CPdibby8PFGjdhORd4g2j52ONrhCgYD5Cnh8=", "type": "Buffer"}, "private": {"data": "0KvioNHSSG8BKQC8BaeeMfSCbBOa8RwBv1VWGFu51nY=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:27	{"public": {"data": "WZDiyeX2WGmcjM34g23hA4RDByAEAqgZ3GOX6wnI4Uw=", "type": "Buffer"}, "private": {"data": "kEe1HyJEoy6TFzx4hUCOsUwmJJekYyhyAlknkrvYD20=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:28	{"public": {"data": "ww0JT686sTOn7W2dWITottNm0O8MApdq+LHXUBuRhQc=", "type": "Buffer"}, "private": {"data": "uNIGME7HQgpIVTK8O4y+koefbTTAI2lJBsW7ye3hDm8=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:29	{"public": {"data": "sKykWe33MT3WCz6S3QTcjRfnS+7J8l2DnSNlGIKOagk=", "type": "Buffer"}, "private": {"data": "2PrN1NcEP/6P7HU+FjaL0t+neWuu9YQeZMwt4pCHBGM=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:pre-key:30	{"public": {"data": "ESyauV9u0T3mTPjArQuhx3z4gGfmGAlbUqmPmC+RXiQ=", "type": "Buffer"}, "private": {"data": "mErsYo3VOLlA9litV0BSBWr41MSJ4jM9TBSAoVyzlF8=", "type": "Buffer"}}	2026-10-19 21:49:33.771346+00
key:session:209264429822062.0	{"version": "v1", "_sessions": {"BQ+k1dMYMkagPhWklprKUNM0uNbuJbtqCc09oWYnWOtL": {"_chains": {"BRC0N04FvM8K47H1GohOIP/GsglEqiKmdfpiRfZg0rU4": {"chainKey": {"key": "qcTTYT0l/ulnw2Zr3lEuog3ESMyj2Q2CWNKr/dO5bc0=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792457755920, "closed": 1792457761686, "baseKey": "BQ+k1dMYMkagPhWklprKUNM0uNbuJbtqCc09oWYnWOtL", "created": 1792457755920, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BQ+k1dMYMkagPhWklprKUNM0uNbuJbtqCc09oWYnWOtL", "preKeyId": 15921760, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "ezABUknMGsyOrqZO8FO28rbODmpjKd9i4WvrT+J0e9w=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BRC0N04FvM8K47H1GohOIP/GsglEqiKmdfpiRfZg0rU4", "privKey": "4NBoa5dCc3V3YsBpU8yNkBumy7SpKm046tzrqyL/bG0="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BQfA7ZEt8xLremcjRAixjoQ48+UYwMGRFpij4ym1IlYZ": {"_chains": {"BdKXAr6bYyyDc3vNagtbJy+5IdlCzM3kirPowFUMgx5V": {"chainKey": {"key": "2oIx5qDrqEDffrot7S3g2yvSLy8A9jHAIo22fOHqrfQ=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792457761612, "closed": 1792591511184, "baseKey": "BQfA7ZEt8xLremcjRAixjoQ48+UYwMGRFpij4ym1IlYZ", "created": 1792457761612, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BQfA7ZEt8xLremcjRAixjoQ48+UYwMGRFpij4ym1IlYZ", "preKeyId": 15921761, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "niOyIVy9Ie7+iEXDOWTDOBBs2ZY/N9ci9Whx+Ul0QVY=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BdKXAr6bYyyDc3vNagtbJy+5IdlCzM3kirPowFUMgx5V", "privKey": "SOU5/ufxRoaecRKezpfqfjSFItennJUDlE3lB6o0Yls="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BRfu/+xlUmEJHnBpz32MyaRBlfAJ7X2nP/RUvNn0P4Je": {"_chains": {"BcLnBnXxc25wo0gnKRDuK4wZ9ue4L5Rf0y0AmUmBYWg9": {"chainKey": {"key": "YWULxaOyMRf+gnbO1w8AxDppE9mg4Ggp9r61vwCY//g=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792594835520, "closed": 1792611970146, "baseKey": "BRfu/+xlUmEJHnBpz32MyaRBlfAJ7X2nP/RUvNn0P4Je", "created": 1792594835520, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BRfu/+xlUmEJHnBpz32MyaRBlfAJ7X2nP/RUvNn0P4Je", "preKeyId": 15921763, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "l4nGGkpwi+jokHd9qKxvaASZMm+Xuk6D/W1F0GGsAxA=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BcLnBnXxc25wo0gnKRDuK4wZ9ue4L5Rf0y0AmUmBYWg9", "privKey": "2Fxz6PjKuOBJPCNFQp9TG6Czdkm06jn4eTtalWdbfGw="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BRvca4MmluLPx+7inLJbo7EbMIzhgQiQpgWQlZLsxXtu": {"_chains": {"BRtZUdJzASlQJaR0GhXvXWbWdLxr9mGeAuvxRx4+2rlc": {"chainKey": {"key": "kY25FRsDLmU5AA1+CkbIdRlaFjzCjggiXaMuMdjl1L0=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792936331077, "closed": 1792936332038, "baseKey": "BRvca4MmluLPx+7inLJbo7EbMIzhgQiQpgWQlZLsxXtu", "created": 1792936331077, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BRvca4MmluLPx+7inLJbo7EbMIzhgQiQpgWQlZLsxXtu", "preKeyId": 15921786, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "ybQ9pXjY0XbLW3uqtNNjW5Nqq1GOICKCak4YIUtid1o=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BRtZUdJzASlQJaR0GhXvXWbWdLxr9mGeAuvxRx4+2rlc", "privKey": "4O8CUIXNo1Vw/CU4N2CKQEK/bGw0JIehHFbfNhdHIVE="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BSZKCC8UrBGepjzFUTxe/WcNtsWul2uPf1BJKgPndNVt": {"_chains": {"BcnyGuhhh4YuEnIUffmskoCCDEsQOdepknRRQwC9YEN1": {"chainKey": {"key": "CVlYt5IKAZt2reSPBNp/Wt2cF6ox/e6WOoTvA/YMolg=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792457750332, "closed": 1792457755994, "baseKey": "BSZKCC8UrBGepjzFUTxe/WcNtsWul2uPf1BJKgPndNVt", "created": 1792457750332, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BSZKCC8UrBGepjzFUTxe/WcNtsWul2uPf1BJKgPndNVt", "preKeyId": 15921759, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "PWqeqDOeP1tPweK0RioROhlZfFniok9IJBHDOgkmZlc=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BcnyGuhhh4YuEnIUffmskoCCDEsQOdepknRRQwC9YEN1", "privKey": "4KnMBGfaSXH0WamyPpc/EaBgMxOUEuv+2oiNWYMAA14="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BTJu+gcC8xJtItW8QUpfqXRQ++T0T9yCv5L+obyUrDoM": {"_chains": {"BQiT5ZRow9cxRbv38W05QQQPjAz+jlUb67zKXQfeIuRp": {"chainKey": {"key": "RL6Oil93N+491K4vUedBE/Y5/4WjYoq+TF2i6xpDMG4=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792661765453, "closed": 1792661766644, "baseKey": "BTJu+gcC8xJtItW8QUpfqXRQ++T0T9yCv5L+obyUrDoM", "created": 1792661765453, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BTJu+gcC8xJtItW8QUpfqXRQ++T0T9yCv5L+obyUrDoM", "preKeyId": 15921772, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "36wWp/efEU2lCqTdv8zUL+Ms7EvK7XS5zAjJpGzIhkw=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQiT5ZRow9cxRbv38W05QQQPjAz+jlUb67zKXQfeIuRp", "privKey": "EGQgjAcFM35L+x+P8WWfRpXACRTlxYx2x4hXW6lCWGk="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BTK/82FFRvp+m6+0iRo9W+LPSynCyhf4w3qrgtvwMG5b": {"_chains": {"BXjzG2utrewWvwB+ge7FK4WKEtJrcePl8qhZdJ7ODwAu": {"chainKey": {"key": "Xf1qaEoKGd6ETtUFc2wtZNW0CG/HopMFc5bmPsvMS44=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792732526696, "closed": 1792733449170, "baseKey": "BTK/82FFRvp+m6+0iRo9W+LPSynCyhf4w3qrgtvwMG5b", "created": 1792732526696, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BTK/82FFRvp+m6+0iRo9W+LPSynCyhf4w3qrgtvwMG5b", "preKeyId": 15921776, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "0JSKKSuYT+nZ2Nt7oQIaO5l7b2zieptl+6bnPA4eCks=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BXjzG2utrewWvwB+ge7FK4WKEtJrcePl8qhZdJ7ODwAu", "privKey": "YBtXZ/9U5qbFx1sZ5z/INrTwvC7uVAnW/O7MUyk7Y10="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BTSbfqX/dbgH84YtSKFElpOxhmhr3ZGkRaSiXpooVyt7": {"_chains": {"BS7qvVKiBtJ7vFtcg3W0bZCNDwZx49vP475mcVVwcB0u": {"chainKey": {"key": "o2PQJbWJ5iSof8rDYUIiRNN/1hoSutJKUagXOum3nqk=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792628195640, "closed": 1792628200007, "baseKey": "BTSbfqX/dbgH84YtSKFElpOxhmhr3ZGkRaSiXpooVyt7", "created": 1792628195640, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BTSbfqX/dbgH84YtSKFElpOxhmhr3ZGkRaSiXpooVyt7", "preKeyId": 15921768, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "XZy4iMS63mr8mRNWKtMal3KmKI7X1/s6wQi3rD9CPFc=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BS7qvVKiBtJ7vFtcg3W0bZCNDwZx49vP475mcVVwcB0u", "privKey": "uJu8nvnoB87dVdKZIxrJq++o7rrkd6CbLCj1RQ3AxFE="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BTqcob6PCaslPDd1B1vuBmjYEYgzYVUFyeXLJWKEiiBs": {"_chains": {"Ba0htT/nMqAykmcL5uUkb7S3NoQEoSOqy/jNxv1TCWIn": {"chainKey": {"key": "5T3EWj/JJ5jVSWM1VJ9X/nlXOBsttOxtqMYbgyw5lUw=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792944513750, "closed": 1792996490967, "baseKey": "BTqcob6PCaslPDd1B1vuBmjYEYgzYVUFyeXLJWKEiiBs", "created": 1792944513750, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BTqcob6PCaslPDd1B1vuBmjYEYgzYVUFyeXLJWKEiiBs", "preKeyId": 15921790, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "s/VMFclLT+ToYn8+qxsSTLB/7BysgnxHztGEaUQecnA=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "Ba0htT/nMqAykmcL5uUkb7S3NoQEoSOqy/jNxv1TCWIn", "privKey": "ANZNYyvAEsakqf2LgeJtI3u09IaVUzHO9S5krDBscH4="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BU9Q0ITCZXw2F7wM8OcQqGSZQzOevv8xSvuEhGq/Sxw+": {"_chains": {"BfaZN2kQFw/fkG3VcaeNZdT3a4xi6ik+FkqApl7VOjMG": {"chainKey": {"key": "OzuOH2M8TfsqRKv/Oc9QcXJAk6rlyYiJNY5zUc4XLwA=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792661767195, "closed": 1792661768022, "baseKey": "BU9Q0ITCZXw2F7wM8OcQqGSZQzOevv8xSvuEhGq/Sxw+", "created": 1792661767195, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BU9Q0ITCZXw2F7wM8OcQqGSZQzOevv8xSvuEhGq/Sxw+", "preKeyId": 15921774, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "UnCu8aunOHwvB1Ax+t1QfbNG3tQ9gXBNVo4kAHej5Y0=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BfaZN2kQFw/fkG3VcaeNZdT3a4xi6ik+FkqApl7VOjMG", "privKey": "IBXdUKT3XI2L0rSgwFcbNdcvcz9pjWHdhUq0T9ra/2Y="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BUw8JY8Litds2VS1woOVxrQtT9Z4gjbKKbrMnfhWJk9I": {"_chains": {"Be+fKr/dbPCjYkwyFTFWiEQzO3ka/wS7hYcZ5j6TUT8e": {"chainKey": {"key": "P4UrRs9HkSNHlhuNYa5RLxbI4WiHSNvF9/tvyoUcwgI=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792757338950, "closed": 1792836551585, "baseKey": "BUw8JY8Litds2VS1woOVxrQtT9Z4gjbKKbrMnfhWJk9I", "created": 1792757338950, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BUw8JY8Litds2VS1woOVxrQtT9Z4gjbKKbrMnfhWJk9I", "preKeyId": 15921779, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "O7mAPDl6ef9dxems3hcxHLheoX45Xpx+vhVDX4jGz28=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "Be+fKr/dbPCjYkwyFTFWiEQzO3ka/wS7hYcZ5j6TUT8e", "privKey": "mE9AuiA5e1UdPz75+J8/kh/RTVFt6h9B4aMIWA8q8HA="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BV7LHbloynqjfod8UzkUHvDZdCTItbO9DNggtA/+D6ND": {"_chains": {"BfyZr0DPGoSWInStgsh/rVP4pIvwxS4zRa748nG1F3Vv": {"chainKey": {"key": "CFpjVMMfo70dx+WZeIWENhyBwb4pgsNp/v7waiXdRVw=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792661767881, "closed": 1792732526844, "baseKey": "BV7LHbloynqjfod8UzkUHvDZdCTItbO9DNggtA/+D6ND", "created": 1792661767881, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BV7LHbloynqjfod8UzkUHvDZdCTItbO9DNggtA/+D6ND", "preKeyId": 15921775, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "ciHJeZo9jT6enzODUt0W/jkxAqCjk4JmUvNu8MpKbY8=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BfyZr0DPGoSWInStgsh/rVP4pIvwxS4zRa748nG1F3Vv", "privKey": "yL3Ct2EVXLlmLmplRAANfkPGYMyXMkDlWt1Hdjad2Ws="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BVIZCGgy6MGHMdF4HVlTIlPN4uR0kv7OPx2uhgHHmucH": {"_chains": {"BSgeVutBByOAP+ELo+8HacNCz6eFsMdUE4vR7sTPtHAQ": {"chainKey": {"key": "1soyy8sAQwti7fQ7dEKusE0xjkVLyHwUsjNg9bM4M4s=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792628819477, "closed": 1792640082688, "baseKey": "BVIZCGgy6MGHMdF4HVlTIlPN4uR0kv7OPx2uhgHHmucH", "created": 1792628819477, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BVIZCGgy6MGHMdF4HVlTIlPN4uR0kv7OPx2uhgHHmucH", "preKeyId": 15921770, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "S2gTlgxlvXObC1YnJpz/KDjMcA2i44aRPu+P7JKKu9s=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BSgeVutBByOAP+ELo+8HacNCz6eFsMdUE4vR7sTPtHAQ", "privKey": "sB3mSXji/6BigfI/42YAb8BZFRkekGk34NxXFdGrh30="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BWSWNYtBfLd8EAh+H09y5OCy8JtxJiOu2fByEt5XT6se": {"_chains": {"BYPzaKbmguPYRvYONuH5v/rzQFwrZZQlbx7A5cFbSfgs": {"chainKey": {"key": "0OQdAhVlSoJvFXxMfy5cElQ4VEhL7WsO63OpNrcLYJE=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792836551439, "closed": 1792882148691, "baseKey": "BWSWNYtBfLd8EAh+H09y5OCy8JtxJiOu2fByEt5XT6se", "created": 1792836551439, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BWSWNYtBfLd8EAh+H09y5OCy8JtxJiOu2fByEt5XT6se", "preKeyId": 15921781, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "wW3C9otA64u8iqBdjCjUhuELK/oXej2Z/PJELJgisqE=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BYPzaKbmguPYRvYONuH5v/rzQFwrZZQlbx7A5cFbSfgs", "privKey": "MCJ4Y7BmCxwJ1z7+jes3FOML8fUNCmSirxKFWE5iqUw="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BWbsyaehjJpsMgXT3/RIqNATRqB+L+qGivzNmXMR9QQs": {"_chains": {"BXzDNIrbWMM5taC9Ejb7J7y1cyppJf5anxqI6pU7y3gY": {"chainKey": {"key": "UlPuwrvUHUzyGEipSelGieQ6P9iM+1eT4ajgGWMVOmc=", "counter": 8}, "chainType": 2, "messageKeys": {}}, "BethnprIdMLqNMSXnvzdu/tVhknPBcF+xFRIa09MtuZg": {"chainKey": {"key": "ugZEeUslTdiMYj+Oky3l1v0lP69hne8F9yHe0D1AYRw=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792457744663, "closed": 1792457750407, "baseKey": "BWbsyaehjJpsMgXT3/RIqNATRqB+L+qGivzNmXMR9QQs", "created": 1792457744663, "baseKeyType": 2, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "currentRatchet": {"rootKey": "9arpydWXfd21EXLqIZ1Msyr6QcU/fREf22FPOBJ3a/s=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BethnprIdMLqNMSXnvzdu/tVhknPBcF+xFRIa09MtuZg", "privKey": "2J9pz0m1TRMZxAr4jyeLDmHVRcNQ2Jyqj96mBYD5lk0="}, "lastRemoteEphemeralKey": "BXzDNIrbWMM5taC9Ejb7J7y1cyppJf5anxqI6pU7y3gY"}, "registrationId": 437099551}, "BXerRTsQ7bxa03RbUv6Ymzx0fy8K5nLf2z8gh92B3IY0": {"_chains": {"BfSH0K5MEFTRAC4irNQM3WYKG+zksSJoRoM47aQzwPhK": {"chainKey": {"key": "ICBEPwwjuAxVOqjN3T92wc/VeVXyDNOHovvyBO/gAF8=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792882148540, "closed": 1792882149374, "baseKey": "BXerRTsQ7bxa03RbUv6Ymzx0fy8K5nLf2z8gh92B3IY0", "created": 1792882148540, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BXerRTsQ7bxa03RbUv6Ymzx0fy8K5nLf2z8gh92B3IY0", "preKeyId": 15921782, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "Tq0FQ8rFu3AwgygEOqV3Hm8iVUN/ZBrRLpgjCU4w9lQ=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BfSH0K5MEFTRAC4irNQM3WYKG+zksSJoRoM47aQzwPhK", "privKey": "wDScRDqkioyYX2/UQIAp3gPVMlgrec9tXmuXLXpz32M="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BYFFdKZbvZF/xQ55+QB+bUqPxros23FVK0qN3UFLlBoL": {"_chains": {"BaTTb3AcXEhbgTIMEAKT1PEfX3s+isZzdVMfN+15eRl4": {"chainKey": {"key": "m8Q5DSGcPn65ENo33UqeZ/nVuRQtIMvJGtY/ZhhHp/Q=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792640082550, "closed": 1792661766024, "baseKey": "BYFFdKZbvZF/xQ55+QB+bUqPxros23FVK0qN3UFLlBoL", "created": 1792640082550, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BYFFdKZbvZF/xQ55+QB+bUqPxros23FVK0qN3UFLlBoL", "preKeyId": 15921771, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "ZWlMgcefwJ2OoW0ZIL53B0YfdQMoZcxkk9JZdsrZcA8=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BaTTb3AcXEhbgTIMEAKT1PEfX3s+isZzdVMfN+15eRl4", "privKey": "MCv5ZwtAWBImbmc+zM5Vl6PwpGNocj2xvCkdSPvz528="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BYXJR0SWA2mtKBix2Hw11YMobxucW+FeNXFVbVdmnl1R": {"_chains": {"BbnTeicwqMywb9RPbqK5SkgsPQ+a9QCLRf5uyohbu5xq": {"chainKey": {"key": "atCAOKyiKmPvs/XnZu/vz1eVF4teId0qkhnriWJj830=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792882149900, "closed": 1792889575071, "baseKey": "BYXJR0SWA2mtKBix2Hw11YMobxucW+FeNXFVbVdmnl1R", "created": 1792882149900, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BYXJR0SWA2mtKBix2Hw11YMobxucW+FeNXFVbVdmnl1R", "preKeyId": 15921784, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "RunD4fGcmXd0AE+DlZSPqCbZBFTd9C7I5U56kONBGGE=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BbnTeicwqMywb9RPbqK5SkgsPQ+a9QCLRf5uyohbu5xq", "privKey": "QKgEvfRXu5VFHJT26Bvc4tAE8b5vAYotmkXjFqotDUc="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BZJXli7xg09lZ9/k5ySaiszFbDTlu61PvVSHCmVm7KoK": {"_chains": {"BYetcqaERCu5wR6u7xgPZzMlZn7pjo62tEkAG3cx9Q1W": {"chainKey": {"key": "33qAeNVRAk8ixxrnQmXG2XjjL4g1m2OdRUH39mHBoR0=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792611970658, "closed": 1792611971323, "baseKey": "BZJXli7xg09lZ9/k5ySaiszFbDTlu61PvVSHCmVm7KoK", "created": 1792611970658, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BZJXli7xg09lZ9/k5ySaiszFbDTlu61PvVSHCmVm7KoK", "preKeyId": 15921765, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "aWfzjZSigBrMb42pu7RHnQOpBzDnSwMoEoX4bulJ4zw=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BYetcqaERCu5wR6u7xgPZzMlZn7pjo62tEkAG3cx9Q1W", "privKey": "MEZrE8ACFU1hOvQILc7yw/EER1woQ2iDsMsjbDMkUng="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BZQJfkOXy2S4Wr5YmLokRbXDdEL7o8nbQnXz8E2nTzpN": {"_chains": {"BeTCwDUOO3JZr0PmnRBTFgbo8jotgFEgwMt9i8giraEY": {"chainKey": {"key": "s0g+rxWJMzoQ7f1ZZA8zSQ7kPvLIsavbPoQzpGwnI1Q=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792591511105, "closed": 1792594835597, "baseKey": "BZQJfkOXy2S4Wr5YmLokRbXDdEL7o8nbQnXz8E2nTzpN", "created": 1792591511105, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BZQJfkOXy2S4Wr5YmLokRbXDdEL7o8nbQnXz8E2nTzpN", "preKeyId": 15921762, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "3YI1Kwx2Xmj/3jwoYWux/vPPoW1RVCMphmDOv3ScOoU=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BeTCwDUOO3JZr0PmnRBTFgbo8jotgFEgwMt9i8giraEY", "privKey": "QP3mr2XpIAdPt7gYhbG8Bs9QTGP0EJ1r5qGhdIqe2UA="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "Ba+mRW2fA8Vfhfg6qB8vR+Btr/BSGVhX9lgpJQC2yGtV": {"_chains": {"BUhdG/tGrZxHxb162hePH2t9acepioWj2tEX1By9ntUO": {"chainKey": {"key": "jba+5c5qzk779OkWI+n27oXgc23R1CGthL7H5pqmbOE=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792936331894, "closed": 1792936672479, "baseKey": "Ba+mRW2fA8Vfhfg6qB8vR+Btr/BSGVhX9lgpJQC2yGtV", "created": 1792936331894, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "Ba+mRW2fA8Vfhfg6qB8vR+Btr/BSGVhX9lgpJQC2yGtV", "preKeyId": 15921787, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "8g79cDUte73iYht3NTJHVp3VDKOcO2RnAZo+fjv2vMg=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BUhdG/tGrZxHxb162hePH2t9acepioWj2tEX1By9ntUO", "privKey": "+FBGmdYpajGIMTzbHVztWRcyBw8hXbv4dGsemVtZono="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "Bb2+e2YaObTiqgS/3YLnRU7GbmGxWYLM9FGSsvR7riYi": {"_chains": {"BQAoKiyzL/n0uwA82qX/pGrXqT4iv6qxU2ERYiXiJcpt": {"chainKey": {"key": "CHENhr4U5iNxWHnZ+ZcX0GXwEzw7fvdAX26oDaseH7g=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792937719543, "closed": 1792944513905, "baseKey": "Bb2+e2YaObTiqgS/3YLnRU7GbmGxWYLM9FGSsvR7riYi", "created": 1792937719543, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "Bb2+e2YaObTiqgS/3YLnRU7GbmGxWYLM9FGSsvR7riYi", "preKeyId": 15921789, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "CWVNLfkFdGz0nmH3oj69B1gLuc9yzUOtGmfy05KWpuc=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQAoKiyzL/n0uwA82qX/pGrXqT4iv6qxU2ERYiXiJcpt", "privKey": "UD4HC4HfYvlF+wCsmg82fi5qTpVXhiTJ3LKxSdALxmQ="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BbNxKBNQMiFhXXYO/lh6/GVzPrJjb3e2rgcseH1inzRx": {"_chains": {"BX/GFtJs+EG489sflVAlpIAYYdttbnAhUCeLTN8YeHYC": {"chainKey": {"key": "ARv1ZBRAv0AKHYCcbaDhn2XwvBWcFndcXTs8NPkHots=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792661766503, "closed": 1792661767335, "baseKey": "BbNxKBNQMiFhXXYO/lh6/GVzPrJjb3e2rgcseH1inzRx", "created": 1792661766503, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BbNxKBNQMiFhXXYO/lh6/GVzPrJjb3e2rgcseH1inzRx", "preKeyId": 15921773, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "/XcAr76CHXzXEsE9b/Axt6xuRfoZB/CPkxCyY/Ne9LM=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BX/GFtJs+EG489sflVAlpIAYYdttbnAhUCeLTN8YeHYC", "privKey": "MPvF4KlPf68P9juSzRGxWy4EWMVgLih42K4v1pMFLWM="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BcAoQ7Tm5jMpYF3fqoyuoPCvRA4kXb96n5S/HB6Vo1VH": {"_chains": {"BQT9bfy326TFLy56QyYqfW3CJ3+jNXFYfV4wx4oEcZsL": {"chainKey": {"key": "wvHwMvQdx6gNF3Q5Abap9S2RO0JVq42h0F3KYz7Zcq8=", "counter": 7}, "chainType": 2, "messageKeys": {}}, "BUBr848RxGLm6qVvpeDv6dj4R+UF25vAAAA4+/np5qUa": {"chainKey": {"key": "KEgPRHQ5KcG0QGJ15eKDeaB+ZcfSpLsbh2KxOKqrS7g=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792446571910, "closed": 1792457744662, "baseKey": "BcAoQ7Tm5jMpYF3fqoyuoPCvRA4kXb96n5S/HB6Vo1VH", "created": 1792446571910, "baseKeyType": 2, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "currentRatchet": {"rootKey": "khW9012U3vBjjuSi06dp2xr1vyfLpgxuh7lDDj3finA=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BUBr848RxGLm6qVvpeDv6dj4R+UF25vAAAA4+/np5qUa", "privKey": "UCnFkpXebnWR53fM9uKxKu3ZqJd1KsG8yE+DU4hXrXQ="}, "lastRemoteEphemeralKey": "BQT9bfy326TFLy56QyYqfW3CJ3+jNXFYfV4wx4oEcZsL"}, "registrationId": 437099551}, "BcU0fwqhY2AzlOtXK6n9vGk9MB+SMzHYkNscRTM8ge5V": {"_chains": {"BXc5lPtchhrsLTiegnlqsffs9w2bs5StJnhanPTs2V8T": {"chainKey": {"key": "tMw/gmedtV2ldkfiaqDlmXG7r6Ebp7jn4OmdRyMVPG8=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792882149231, "closed": 1792882150042, "baseKey": "BcU0fwqhY2AzlOtXK6n9vGk9MB+SMzHYkNscRTM8ge5V", "created": 1792882149231, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BcU0fwqhY2AzlOtXK6n9vGk9MB+SMzHYkNscRTM8ge5V", "preKeyId": 15921783, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "9YpujiYO5XxI5b591zMDnUyiQeMBRe4QPj8NuyvlzYo=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BXc5lPtchhrsLTiegnlqsffs9w2bs5StJnhanPTs2V8T", "privKey": "2NbEo3KK1xkDDvM6+/gh5A8hBsc0RIhFC4CLMA4Mf3g="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BcaGL4hsBalqubUogpUQM/yxuBLvYggxWTBfM7/b3iYo": {"_chains": {"BdRq/dIj59nHKOkyFsrtA+XpFeUpz9Da8NM9qq8YrPpK": {"chainKey": {"key": "Ox8zpig3mNf+fYhQRcnrjIS5MOpKtd/i+OqyXmy31r4=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792733449028, "closed": 1792757339098, "baseKey": "BcaGL4hsBalqubUogpUQM/yxuBLvYggxWTBfM7/b3iYo", "created": 1792733449028, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BcaGL4hsBalqubUogpUQM/yxuBLvYggxWTBfM7/b3iYo", "preKeyId": 15921778, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "QQOSlytgh80RPjlotGNyZzk3sAeBhE1DurNQzAvz4LA=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BdRq/dIj59nHKOkyFsrtA+XpFeUpz9Da8NM9qq8YrPpK", "privKey": "2IQ1abzhlwFRLjfafW8Ojjt0BvT9flcYN73Xxg5XIHg="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BcxaIU385cZfCUw/zbT9usHRoeTK7teIFPTQ4b5aIsUz": {"_chains": {"BUsKf+Ry2VdNIOmDlHJ3GIOwjZ70Qn4JzNTvlIHlRWZl": {"chainKey": {"key": "QVEtPBS5eSpVd3sNqsASswN88GAL0vd6ynbpf+4XdGA=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792996490817, "closed": 1793021980237, "baseKey": "BcxaIU385cZfCUw/zbT9usHRoeTK7teIFPTQ4b5aIsUz", "created": 1792996490817, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BcxaIU385cZfCUw/zbT9usHRoeTK7teIFPTQ4b5aIsUz", "preKeyId": 15921792, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "Sj49uU4s6Xm9dt6sJqxjIolgmySlOGrOWY/d0I6e7RE=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BUsKf+Ry2VdNIOmDlHJ3GIOwjZ70Qn4JzNTvlIHlRWZl", "privKey": "mBOLcVG4corOcpTBSrJ8fIr8Gy7hhC8uK8Mc2v7CxX4="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "Bd4facRiC5PT2zmSRzzDzu7yIdcz/qd8OQQoz1kNyCsm": {"_chains": {"BbG3Dzu5leidVRELIIkXtba6/St6Uf8vfsSco1I7lVEE": {"chainKey": {"key": "1+gIigakFQFa8rRZXg0XZkdKnjEfW3bP4B0AkNNHJbw=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792936672332, "closed": 1792937719691, "baseKey": "Bd4facRiC5PT2zmSRzzDzu7yIdcz/qd8OQQoz1kNyCsm", "created": 1792936672332, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "Bd4facRiC5PT2zmSRzzDzu7yIdcz/qd8OQQoz1kNyCsm", "preKeyId": 15921788, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "+PIu9OQpP3ptU5Mg+nJkSU1HZZ1HuF4QLi8QYn/eFJ4=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BbG3Dzu5leidVRELIIkXtba6/St6Uf8vfsSco1I7lVEE", "privKey": "wPGMrFRMY97fAjQxTtqyal7wb2KyKZed3kbMPlGmHVQ="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BdKp0vbExCdIrtzEB7bufFPns5BQtXwMaPFv33S6qmJS": {"_chains": {"BYxRzRKb14a05VYH1KaQxx9fdi4kW7FpQGD+NwFxZVQF": {"chainKey": {"key": "ZItwo9wZn2BFspWUX+4RpEgEoE7Ke0UN0+SqEWi6zEA=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792628199932, "closed": 1792628819551, "baseKey": "BdKp0vbExCdIrtzEB7bufFPns5BQtXwMaPFv33S6qmJS", "created": 1792628199932, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BdKp0vbExCdIrtzEB7bufFPns5BQtXwMaPFv33S6qmJS", "preKeyId": 15921769, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "NhcZDxzZOqD7rRM8acwmehLTYhzovG2sYSUslLlBnEc=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BYxRzRKb14a05VYH1KaQxx9fdi4kW7FpQGD+NwFxZVQF", "privKey": "yKC1hH0k9HKGCMN+knVDejHEEcoIFVfyPLqRIDaCO3E="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BdtMg4W70nru+Rv5bLljjQVYB62E9JTEawJLnQC0E4xo": {"_chains": {"BfonnKA9xqsvjIsi0i6XaMN3X3Dt6ufk3a3I3O2hDMIC": {"chainKey": {"key": "jJ8dBeOELYti0OgnLMHbjdfDRydtmHvQk/8XZKZo9rU=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792889574921, "closed": 1792936331227, "baseKey": "BdtMg4W70nru+Rv5bLljjQVYB62E9JTEawJLnQC0E4xo", "created": 1792889574921, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BdtMg4W70nru+Rv5bLljjQVYB62E9JTEawJLnQC0E4xo", "preKeyId": 15921785, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "xZ5c6IIVrZh6Oexrzf2gMrFMTZ3NrMfrYcUVn32KDMs=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BfonnKA9xqsvjIsi0i6XaMN3X3Dt6ufk3a3I3O2hDMIC", "privKey": "wBY1lvwoPUfiFyJLVm3+Kn2CbRu+ujElOxY6J8Voum0="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BeRk15E+vuA+Fsr9ame6y24PMoZxuTsGa84DqMxnXPhQ": {"_chains": {"BQVQa6MNJQT15J/JDDumDWAQelATMGxoJcBr55Rb6AZS": {"chainKey": {"key": "CAgfHM/5rE73D4l+a2DIIIE0srwzrKRDVIVmEBtn1l0=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1793021980092, "closed": -1, "baseKey": "BeRk15E+vuA+Fsr9ame6y24PMoZxuTsGa84DqMxnXPhQ", "created": 1793021980092, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BeRk15E+vuA+Fsr9ame6y24PMoZxuTsGa84DqMxnXPhQ", "preKeyId": 15921793, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "xfYjc5gsOYkQx/z0ik0PZhtuPi5OGetqZIel5OuefqY=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQVQa6MNJQT15J/JDDumDWAQelATMGxoJcBr55Rb6AZS", "privKey": "gC/ZIttDj+/qhCqulUtgW+ckP/CTP3kiNO9BmODkG3c="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "BfbTRyJjX+jEOpS9Fl9Te4NXbBWtN9ruf1YiTUC32oJK": {"_chains": {"BQX2a8Lsmc/mAVp6zX/RQc8IQzaLQgUwVpcmMTrmf7sB": {"chainKey": {"key": "x6pswlWr0oL/tUm4KS3WnVKVmKOBSaow/YSKRP4MyhA=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792611971248, "closed": 1792628195722, "baseKey": "BfbTRyJjX+jEOpS9Fl9Te4NXbBWtN9ruf1YiTUC32oJK", "created": 1792611971248, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "BfbTRyJjX+jEOpS9Fl9Te4NXbBWtN9ruf1YiTUC32oJK", "preKeyId": 15921766, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "qoudtlPPApX7h45ge/Hez5FaFX0Syg+VVEOuYqOe1Nw=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BQX2a8Lsmc/mAVp6zX/RQc8IQzaLQgUwVpcmMTrmf7sB", "privKey": "YCBhP6jFIwtHk9ESf+8uVpljXAFGJe5luQIkyzsuOE4="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}, "Bfp2wqiZkjYYTzvvxe4tjRIipdWdzkfolMLV5Oe2/CIi": {"_chains": {"BSDNoiTtMykN0Lrdg6CuALeodmcSXb/VWSa4eQIpfL4K": {"chainKey": {"key": "tH04GPiYVx8WioTcQpmi7SFgJzEEWRj6REacIVpanh8=", "counter": -1}, "chainType": 1, "messageKeys": {}}}, "indexInfo": {"used": 1792611970068, "closed": 1792611970734, "baseKey": "Bfp2wqiZkjYYTzvvxe4tjRIipdWdzkfolMLV5Oe2/CIi", "created": 1792611970068, "baseKeyType": 1, "remoteIdentityKey": "BQ/oQTy2T0kaU5NlykMW8ka2OASMWVw/gSqJD/LG5DlR"}, "pendingPreKey": {"baseKey": "Bfp2wqiZkjYYTzvvxe4tjRIipdWdzkfolMLV5Oe2/CIi", "preKeyId": 15921764, "signedKeyId": 6247529}, "currentRatchet": {"rootKey": "uQ8+1z+ZzeXB32QD1mI6xgJmJgS2NRyTsMOMjlqm5II=", "previousCounter": 0, "ephemeralKeyPair": {"pubKey": "BSDNoiTtMykN0Lrdg6CuALeodmcSXb/VWSa4eQIpfL4K", "privKey": "EBJ5TOeycuCDhX52UuxyA2X6EhOIu393ov1x2nbw3EE="}, "lastRemoteEphemeralKey": "BfmQ5yTuPMuve+ckE7sNVO1hXT28xMRFtt45wzNDU5ot"}, "registrationId": 437099551}}}	2026-10-26 13:39:40.273959+00
metadata	{"name": "Faz Network", "phone": "+8801339932887", "linkedSince": "2026-10-19T21:49:33.855Z"}	2026-10-26 14:28:54.858204+00
\.


ALTER TABLE public.whatsapp_sessions ENABLE TRIGGER ALL;

--
-- Data for Name: whatsapp_socket_lease; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public.whatsapp_socket_lease DISABLE TRIGGER ALL;

COPY public.whatsapp_socket_lease (lock_key, owner_pid, heartbeat_at) FROM stdin;
20261017	1294826	2026-10-26 11:29:26.477114+00
\.


ALTER TABLE public.whatsapp_socket_lease ENABLE TRIGGER ALL;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE realtime.schema_migrations DISABLE TRIGGER ALL;

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2026-10-14 18:25:19
20211116045059	2026-10-14 18:25:19
20211116050929	2026-10-14 18:25:19
20211116051442	2026-10-14 18:25:19
20211116212300	2026-10-14 18:25:19
20211116213355	2026-10-14 18:25:19
20211116213934	2026-10-14 18:25:19
20211116214523	2026-10-14 18:25:19
20211122062447	2026-10-14 18:25:19
20211124070109	2026-10-14 18:25:19
20211202204204	2026-10-14 18:25:19
20211202204605	2026-10-14 18:25:19
20211210212804	2026-10-14 18:25:19
20211228014915	2026-10-14 18:25:19
20220107221237	2026-10-14 18:25:19
20220228202821	2026-10-14 18:25:19
20220312004840	2026-10-14 18:25:19
20220603231003	2026-10-14 18:25:19
20220603232444	2026-10-14 18:25:19
20220615214548	2026-10-14 18:25:19
20220712093339	2026-10-14 18:25:19
20220908172859	2026-10-14 18:25:19
20220916233421	2026-10-14 18:25:19
20230119133233	2026-10-14 18:25:19
20230128025114	2026-10-14 18:25:19
20230128025212	2026-10-14 18:25:19
20230227211149	2026-10-14 18:25:19
20230228184745	2026-10-14 18:25:19
20230308225145	2026-10-14 18:25:19
20230328144023	2026-10-14 18:25:19
20231018144023	2026-10-14 18:25:19
20231204144023	2026-10-14 18:25:19
20231204144024	2026-10-14 18:25:19
20231204144025	2026-10-14 18:25:19
20240108234812	2026-10-14 18:25:19
20240109165339	2026-10-14 18:25:19
20240227174441	2026-10-14 18:25:19
20240311171622	2026-10-14 18:25:19
20240321100241	2026-10-14 18:25:19
20240401105812	2026-10-14 18:25:19
20240418121054	2026-10-14 18:25:19
20240523004032	2026-10-14 18:25:19
20240618124746	2026-10-14 18:25:19
20240801235015	2026-10-14 18:25:19
20240805133720	2026-10-14 18:25:19
20240827160934	2026-10-14 18:25:19
20240919163303	2026-10-14 18:25:19
20240919163305	2026-10-14 18:25:19
20241019105805	2026-10-14 18:25:19
20241030150047	2026-10-14 18:25:19
20241108114728	2026-10-14 18:25:19
20241121104152	2026-10-14 18:25:19
20241130184212	2026-10-14 18:25:19
20241220035512	2026-10-14 18:25:19
20241220123912	2026-10-14 18:25:19
20241224161212	2026-10-14 18:25:19
20250107150512	2026-10-14 18:25:19
20250110162412	2026-10-14 18:25:19
20250123174212	2026-10-14 18:25:19
20250128220012	2026-10-14 18:25:19
20250506224012	2026-10-14 18:25:19
20250523164012	2026-10-14 18:25:19
20250714121412	2026-10-14 18:25:19
20250905041441	2026-10-14 18:25:19
20251103001201	2026-10-14 18:25:19
20251120212548	2026-10-14 18:25:19
20251120215549	2026-10-14 18:25:19
20260218120000	2026-10-14 18:25:19
20260326120000	2026-10-14 18:25:19
20260514120000	2026-10-14 18:25:19
20260527120000	2026-10-14 18:25:19
20260528120000	2026-10-14 18:25:19
20260603120000	2026-10-14 18:25:19
20260605120000	2026-10-14 18:25:19
20260606110000	2026-10-14 18:25:19
20260616120000	2026-10-14 18:25:19
20260624120000	2026-10-14 18:25:19
20260626120000	2026-10-14 18:25:19
20260706120000	2026-10-14 18:25:19
20260707120000	2026-10-14 18:25:19
20260709120000	2026-10-14 18:25:19
20260714120000	2026-10-14 18:25:19
20260827120000	2026-10-14 18:25:19
20260914120000	2026-10-14 18:25:19
20260916120000	2026-10-14 18:25:19
20260922120000	2026-10-14 18:25:19
20260925120000	2026-10-14 18:25:19
20260928120000	2026-10-14 18:25:19
20261002120000	2026-10-14 18:25:19
20261008120000	2026-10-19 11:40:52
20261009120000	2026-10-19 11:40:52
\.


ALTER TABLE realtime.schema_migrations ENABLE TRIGGER ALL;

--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.subscription DISABLE TRIGGER ALL;

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at, action_filter, selected_columns) FROM stdin;
\.


ALTER TABLE realtime.subscription ENABLE TRIGGER ALL;

--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets DISABLE TRIGGER ALL;

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type, versioning_status, lifecycle_configuration, lifecycle_configuration_generation) FROM stdin;
\.


ALTER TABLE storage.buckets ENABLE TRIGGER ALL;

--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics DISABLE TRIGGER ALL;

COPY storage.buckets_analytics (name, type, format, created_at, updated_at, id, deleted_at) FROM stdin;
\.


ALTER TABLE storage.buckets_analytics ENABLE TRIGGER ALL;

--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors DISABLE TRIGGER ALL;

COPY storage.buckets_vectors (id, type, created_at, updated_at) FROM stdin;
\.


ALTER TABLE storage.buckets_vectors ENABLE TRIGGER ALL;

--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations DISABLE TRIGGER ALL;

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2026-10-14 18:25:14.907774
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2026-10-14 18:25:14.918843
2	storage-schema	f6a1fa2c93cbcd16d4e487b362e45fca157a8dbd	2026-10-14 18:25:14.921601
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2026-10-14 18:25:14.936547
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2026-10-14 18:25:14.949416
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2026-10-14 18:25:14.952104
6	change-column-name-in-get-size	ded78e2f1b5d7e616117897e6443a925965b30d2	2026-10-14 18:25:14.955211
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2026-10-14 18:25:14.958909
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2026-10-14 18:25:14.961372
9	fix-search-function	af597a1b590c70519b464a4ab3be54490712796b	2026-10-14 18:25:14.964086
10	search-files-search-function	b595f05e92f7e91211af1bbfe9c6a13bb3391e16	2026-10-14 18:25:14.967641
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2026-10-14 18:25:14.970499
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2026-10-14 18:25:14.973646
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2026-10-14 18:25:14.976436
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2026-10-14 18:25:14.979897
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2026-10-14 18:25:14.998241
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2026-10-14 18:25:15.000913
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2026-10-14 18:25:15.003732
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2026-10-14 18:25:15.006591
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2026-10-14 18:25:15.010116
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2026-10-14 18:25:15.012772
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2026-10-14 18:25:15.016561
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2026-10-14 18:25:15.028171
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2026-10-14 18:25:15.035705
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2026-10-14 18:25:15.039546
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2026-10-14 18:25:15.042378
26	objects-prefixes	215cabcb7f78121892a5a2037a09fedf9a1ae322	2026-10-14 18:25:15.045584
27	search-v2	859ba38092ac96eb3964d83bf53ccc0b141663a6	2026-10-14 18:25:15.047975
28	object-bucket-name-sorting	c73a2b5b5d4041e39705814fd3a1b95502d38ce4	2026-10-14 18:25:15.050022
29	create-prefixes	ad2c1207f76703d11a9f9007f821620017a66c21	2026-10-14 18:25:15.052176
30	update-object-levels	2be814ff05c8252fdfdc7cfb4b7f5c7e17f0bed6	2026-10-14 18:25:15.054372
31	objects-level-index	b40367c14c3440ec75f19bbce2d71e914ddd3da0	2026-10-14 18:25:15.056512
32	backward-compatible-index-on-objects	e0c37182b0f7aee3efd823298fb3c76f1042c0f7	2026-10-14 18:25:15.058728
33	backward-compatible-index-on-prefixes	b480e99ed951e0900f033ec4eb34b5bdcb4e3d49	2026-10-14 18:25:15.060721
34	optimize-search-function-v1	ca80a3dc7bfef894df17108785ce29a7fc8ee456	2026-10-14 18:25:15.062858
35	add-insert-trigger-prefixes	458fe0ffd07ec53f5e3ce9df51bfdf4861929ccc	2026-10-14 18:25:15.065019
36	optimise-existing-functions	6ae5fca6af5c55abe95369cd4f93985d1814ca8f	2026-10-14 18:25:15.068272
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2026-10-14 18:25:15.070551
38	iceberg-catalog-flag-on-buckets	02716b81ceec9705aed84aa1501657095b32e5c5	2026-10-14 18:25:15.0738
39	add-search-v2-sort-support	6706c5f2928846abee18461279799ad12b279b78	2026-10-14 18:25:15.08095
40	fix-prefix-race-conditions-optimized	7ad69982ae2d372b21f48fc4829ae9752c518f6b	2026-10-14 18:25:15.084642
41	add-object-level-update-trigger	07fcf1a22165849b7a029deed059ffcde08d1ae0	2026-10-14 18:25:15.086685
42	rollback-prefix-triggers	771479077764adc09e2ea2043eb627503c034cd4	2026-10-14 18:25:15.088713
43	fix-object-level	84b35d6caca9d937478ad8a797491f38b8c2979f	2026-10-14 18:25:15.09084
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2026-10-14 18:25:15.092924
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2026-10-14 18:25:15.095694
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2026-10-14 18:25:15.104652
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2026-10-14 18:25:15.108012
48	iceberg-catalog-ids	e0e8b460c609b9999ccd0df9ad14294613eed939	2026-10-14 18:25:15.113194
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2026-10-14 18:25:15.136574
50	search-v2-optimised	6323ac4f850aa14e7387eb32102869578b5bd478	2026-10-14 18:25:15.140262
51	index-backward-compatible-search	2ee395d433f76e38bcd3856debaf6e0e5b674011	2026-10-14 18:25:15.388697
52	drop-not-used-indexes-and-functions	5cc44c8696749ac11dd0dc37f2a3802075f3a171	2026-10-14 18:25:15.389966
53	drop-index-lower-name	d0cb18777d9e2a98ebe0bc5cc7a42e57ebe41854	2026-10-14 18:25:15.398237
54	drop-index-object-level	6289e048b1472da17c31a7eba1ded625a6457e67	2026-10-14 18:25:15.399943
55	prevent-direct-deletes	262a4798d5e0f2e7c8970232e03ce8be695d5819	2026-10-14 18:25:15.40126
56	fix-optimized-search-function	b823ed1e418101032fa01374edc9a436e54e3ed4	2026-10-14 18:25:15.404549
57	s3-multipart-uploads-metadata	f127886e00d1b374fadbc7c6b31e09336aad5287	2026-10-14 18:25:15.408286
58	operation-ergonomics	00ca5d483b3fe0d522133d9002ccc5df98365120	2026-10-14 18:25:15.410679
59	drop-unused-functions	38456f13e39691c2bbb4b5151d0d1cdbabd4a8c4	2026-10-14 18:25:15.413667
60	optimize-existing-functions-again	db35e1c91a9201e59f4fef8d972c2f277d68b157	2026-10-14 18:25:15.416251
61	mark-filename-immutable	fe0096517ae9d60aaec1d110172ba9036dc66bb7	2026-10-14 18:25:15.420376
62	object-versioning-core	0b855f00ff3be0bfca91efee02a9858912491a9a	2026-10-14 18:25:15.424114
63	fix-search-name-relative-to-prefix	c7485e417624f795ce8bb2da21927f48e088904d	2026-10-14 18:25:15.429676
64	fix-search-by-timestamp-sqli	0af424ecd388a39bb1645184b222185a12149675	2026-10-14 18:25:15.433696
65	objects-key-version-index	da319c4b89ba800ce795d1b699f3a70675138058	2026-10-14 18:25:15.441822
66	objects-current-version-index	191466c93aa2c46a00e36505577c5fcab8d7cb4b	2026-10-14 18:25:15.448342
67	objects-null-version-index	15bfe8c35b66642b6c78ba60060fa8793bd2207a	2026-10-14 18:25:15.454516
68	bucket-lifecycle-configuration	3c08f6f889922f399519722a932b51007c11bebc	2026-10-14 18:25:15.455833
69	validate-bucket-lifecycle-constraints	4febacaaaa0e61e2b783bef081fe03a287e65eb3	2026-10-14 18:25:15.462343
70	list-objects-with-versions	5c17c3777616cd8d7b18b82835525fa3205af57b	2026-10-14 18:25:15.465665
71	objects-delete-marker-index	6d14858e66c66f8d6accf8a2630aefd1527fddba	2026-10-14 18:25:15.483149
72	drop-bucketid-objname-index	302beb09e1b469d7d4db19566f2389d280b64aa3	2026-10-14 18:25:15.488153
73	revoke-grants-to-unused-operations	ba9244051be09f22f714fc0170a2539f8b5f0e68	2026-10-14 18:25:15.4895
\.


ALTER TABLE storage.migrations ENABLE TRIGGER ALL;

--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects DISABLE TRIGGER ALL;

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata, archived_at, is_delete_marker, is_versioned) FROM stdin;
\.


ALTER TABLE storage.objects ENABLE TRIGGER ALL;

--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads DISABLE TRIGGER ALL;

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata, metadata) FROM stdin;
\.


ALTER TABLE storage.s3_multipart_uploads ENABLE TRIGGER ALL;

--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts DISABLE TRIGGER ALL;

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


ALTER TABLE storage.s3_multipart_uploads_parts ENABLE TRIGGER ALL;

--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes DISABLE TRIGGER ALL;

COPY storage.vector_indexes (id, name, bucket_id, data_type, dimension, distance_metric, metadata_configuration, created_at, updated_at) FROM stdin;
\.


ALTER TABLE storage.vector_indexes ENABLE TRIGGER ALL;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE supabase_migrations.schema_migrations DISABLE TRIGGER ALL;

COPY supabase_migrations.schema_migrations (version, statements, name, created_by, idempotency_key, rollback) FROM stdin;
20261026031224	{"-- Hotspot device binding lifecycle. Router-origin data is stored separately from PPPoE subscribers.\nCREATE TABLE IF NOT EXISTS hotspot_ip_bindings (\n  id BIGSERIAL PRIMARY KEY,\n  mac_address TEXT NOT NULL,\n  ip_address INET,\n  customer_name TEXT,\n  phone TEXT,\n  comment TEXT NOT NULL DEFAULT '',\n  binding_type TEXT NOT NULL DEFAULT 'bypassed'\n    CHECK (binding_type IN ('bypassed', 'regular', 'blocked')),\n  package_id TEXT,\n  bandwidth_profile TEXT NOT NULL DEFAULT 'unlimited',\n  expiry_date TIMESTAMPTZ,\n  status TEXT NOT NULL DEFAULT 'disabled'\n    CHECK (status IN ('active', 'expired', 'disabled')),\n  router_binding_id TEXT,\n  last_synced_at TIMESTAMPTZ,\n  router_sync_error TEXT,\n  expiry_processing_started_at TIMESTAMPTZ,\n  archived_at TIMESTAMPTZ,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);\nCREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_ip_bindings_active_mac\n  ON hotspot_ip_bindings (upper(mac_address)) WHERE status = 'active';\nCREATE INDEX IF NOT EXISTS idx_hotspot_ip_bindings_due_expiry\n  ON hotspot_ip_bindings (expiry_date, id) WHERE status = 'active' AND expiry_date IS NOT NULL;\nALTER TABLE hotspot_ip_bindings ENABLE ROW LEVEL SECURITY;\nDO $$\nBEGIN\n  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN\n    EXECUTE 'REVOKE ALL ON TABLE hotspot_ip_bindings FROM anon';\n  END IF;\n  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN\n    EXECUTE 'REVOKE ALL ON TABLE hotspot_ip_bindings FROM authenticated';\n  END IF;\n  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN\n    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hotspot_ip_bindings TO service_role';\n    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE hotspot_ip_bindings_id_seq TO service_role';\n  END IF;\nEND $$;\n"}	hotspot_ip_binding_lifecycle_20261026	faznetwork.com@gmail.com	\N	\N
\.


ALTER TABLE supabase_migrations.schema_migrations ENABLE TRIGGER ALL;

--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--

ALTER TABLE vault.secrets DISABLE TRIGGER ALL;

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


ALTER TABLE vault.secrets ENABLE TRIGGER ALL;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 1, false);


--
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_audit_logs_id_seq', 50, true);


--
-- Name: admin_invitations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_invitations_id_seq', 23, true);


--
-- Name: admin_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_users_id_seq', 12, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 184, true);


--
-- Name: broadcast_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.broadcast_logs_id_seq', 1, false);


--
-- Name: broadcast_recipients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.broadcast_recipients_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 39, true);


--
-- Name: email_outbox_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.email_outbox_id_seq', 12, true);


--
-- Name: expenses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.expenses_id_seq', 1, false);


--
-- Name: hotspot_ip_bindings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hotspot_ip_bindings_id_seq', 1, false);


--
-- Name: hotspot_portal_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hotspot_portal_settings_id_seq', 1, true);


--
-- Name: hotspot_vouchers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hotspot_vouchers_id_seq', 85, true);


--
-- Name: hr_departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hr_departments_id_seq', 1, false);


--
-- Name: hr_employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hr_employees_id_seq', 1, false);


--
-- Name: ip_pools_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ip_pools_id_seq', 33, true);


--
-- Name: network_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.network_devices_id_seq', 7, true);


--
-- Name: network_discovery_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.network_discovery_runs_id_seq', 35, true);


--
-- Name: network_discovery_sources_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.network_discovery_sources_id_seq', 1, false);


--
-- Name: network_observations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.network_observations_id_seq', 1503, true);


--
-- Name: network_topology_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.network_topology_links_id_seq', 1, false);


--
-- Name: notification_delivery_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_delivery_logs_id_seq', 7, true);


--
-- Name: notification_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_templates_id_seq', 12, true);


--
-- Name: packages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.packages_id_seq', 19, true);


--
-- Name: payment_reconciliation_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_reconciliation_audit_id_seq', 1, false);


--
-- Name: payment_webhook_quarantine_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_webhook_quarantine_id_seq', 7, true);


--
-- Name: pppoe_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pppoe_profiles_id_seq', 210, true);


--
-- Name: pppoe_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pppoe_users_id_seq', 782, true);


--
-- Name: router_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.router_devices_id_seq', 2, true);


--
-- Name: server_settings_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.server_settings_audit_id_seq', 13, true);


--
-- Name: sms_delivery_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sms_delivery_logs_id_seq', 74, true);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 1, true);


--
-- Name: system_server_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_server_settings_id_seq', 2, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 60, true);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: supabase_realtime_admin
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict mCG53z86NpVMwxytnOMJX2AyP6IngqSNHbSO0fFwu4UJbblkjyYcEkUhMvjlBGc

