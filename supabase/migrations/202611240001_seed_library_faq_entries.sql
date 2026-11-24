-- Seed the official FAQ snapshot as librarian-editable entries.
-- Fixed IDs and DO NOTHING make this safe to re-run without replacing edits.
begin;

insert into public.librarian_knowledge_entries (id, kind, category, title, content, source_url)
values
  ('dd145e1f-a8bf-4330-be3d-ad684fac8d48', 'faq', 'contact', 'Where is the APC Library located?',
   $$The APC Library is located at the 7th Floor Building, 3 Humabon Place, Magallanes, Makati City.$$,
   'https://library.apc.edu.ph/faqs'),
  ('996571c5-42b5-4f55-b35f-e0b272f81301', 'faq', 'contact', 'How can I contact the library?',
   $$Email: library@apc.edu.ph
Facebook: Asia Pacific College Library (https://www.facebook.com/AsiaPacificCollegeLibrary)
Telephone: +63 2 8852 9232 / Local 406 or 407$$,
   'https://library.apc.edu.ph/faqs'),
  ('22058a99-b004-4a85-ab90-0160955d04bc', 'faq', 'services', 'Do you accept visiting researchers?',
   $$Yes, visiting researchers are welcome at the APC Library.
Requirements:
- On the date of your visit, bring a valid school/university/company ID, a copy or screenshot of the email approval, and present the referral letter from your office/school head librarian requesting the privilege to use the APC Library along with their authorized signature.
- Fill out the Visiting Researcher Form: https://forms.office.com/pages/responsepage.aspx?id=5kW3rmaBj0-SMxeegQnEntqUwPFEdc1BtaFdoW5krGBUNTE0MlhPMUhGWEo2UE1OV0E2UEFBTEpIQy4u&route=shorturl
Fees:
- APC Alumni: Free of charge (present an updated alumni ID).
- Consortium Partners (all NU campuses): Free of charge.
- Graduate/undergraduate students from other schools or institutions: Php 50.00 per visit.
- Private and government researchers: Php 100.00 per visit.
See Guidelines for Visitors and Non-APC Researchers: https://library.apc.edu.ph/cgi-bin/koha/pages.pl?p=guidelines-for-non-apc-researchers$$,
   'https://library.apc.edu.ph/faqs'),
  ('9f9a5e6e-d48a-42ee-a84b-eba7c790762d', 'faq', 'rules', 'Can I eat or drink inside the library?',
   $$Eating is not allowed in the main library and open discussion area. Students caught eating or drinking in these areas will be reported to the Discipline Office.$$,
   'https://library.apc.edu.ph/faqs'),
  ('d626b81f-32bb-439e-99da-12f9e1de4584', 'faq', 'services', 'Do you allow charging of electronic devices inside the library?',
   $$Charging of electronic devices is allowed inside the library.$$,
   'https://library.apc.edu.ph/faqs'),
  ('7fb0a454-10e4-4d39-8af0-6ad1105c74d0', 'faq', 'services', 'How do I access Wi-Fi inside the library?',
   $$Connect your electronic device to "WiFi-Library" and ask the librarian-in-charge for the password.$$,
   'https://library.apc.edu.ph/faqs'),
  ('8ad2cc59-0bd0-49bd-b41a-94e061bfb7a5', 'faq', 'rules', 'How many books I can borrow?',
   $$There is no limit on the number of books that may be borrowed.$$,
   'https://library.apc.edu.ph/faqs'),
  ('c6872632-697f-4058-9c70-fbe87a060cb1', 'faq', 'rules', 'How much is the library fine?',
   $$The APC Library has a penalty of Php 20.00 per book, per day for late returns.$$,
   'https://library.apc.edu.ph/faqs'),
  ('75af2eb2-f93f-4c9a-a7f6-153cbe46f981', 'faq', 'rules', 'How many days can I borrow a book?',
   $$Students:
- CFP Collection/Circulation/Filipiniana Section: 14 days.
- Reserve Section: 1 day.
- Reference/Periodicals/Special Collection: for use within the APC Library only.
Full-Time and Adjunct Lecturers:
- CFP Collection/Circulation/Filipiniana Section: 14 days.
- Reserve Section: 7 days.
- Reference/Periodicals/Special Collection: for use within the APC Library only.$$,
   'https://library.apc.edu.ph/faqs'),
  ('69df59e3-200d-4be4-85d5-b7dbd9580757', 'faq', 'services', 'Can I renew borrowed books?',
   $$Yes. Go to the APC Library and ask the Librarian-in-charge to renew your borrowed books.$$,
   'https://library.apc.edu.ph/faqs'),
  ('914094cd-461f-4fb6-9dda-f15b3ad8e3d6', 'faq', 'services', 'Can I renew borrowed books online?',
   $$Yes. Email library@apc.edu.ph with your full name, the title(s) of the book(s), and the book barcode (on the back of the book). You may also send images of the front and back of the book(s). You can message the librarians via MS Teams; see the Organizational Structure: https://library.apc.edu.ph/about/organizational-structure$$,
   'https://library.apc.edu.ph/faqs'),
  ('14400f4e-d95f-44b9-85d3-63aa231f2ca3', 'faq', 'services', 'How do I borrow theses papers?',
   $$Go to the main library and ask the Librarian-in-charge for the list of theses by school. Scan the QR code and fill out the form. Theses papers are for viewing/reading within the APC Library premises only.$$,
   'https://library.apc.edu.ph/faqs'),
  ('f6f3520d-f789-4f5f-baef-b67bd6b10371', 'faq', 'rules', 'I have an overdue book/s, how do I pay my fines?',
   $$After you have returned your overdue item, fines will be computed and indicated in an overdue slip issued by the Librarian-in-charge. Proceed to the Finance Office (4th floor) and pay the indicated amount. Go back to the library to present the official receipt to the librarian. The Librarian will process and clear your library overdue fine in the library system. You will receive an email from the APC Library regarding the confirmation of your payment. For further assistance, email library@apc.edu.ph.$$,
   'https://library.apc.edu.ph/faqs'),
  ('b1f99599-38df-4623-877d-632245f88a09', 'faq', 'services', 'How do I access E-Books?',
   $$There are two types of e-books accessible online in the APC Library: Library subscription e-books and e-books available through APC’s Online Catalog. To access subscription e-books, visit the Koha Online Catalog: https://library.apc.edu.ph/. For e-books available through APC’s Online Catalog, search by title, author, or subject in the Koha OPAC. For more details, refer to the Guide to E-Books.$$,
   'https://library.apc.edu.ph/faqs'),
  ('c205e23e-6279-48c3-9ed8-0dd28d2456af', 'faq', 'services', 'Can I access online resources from home?',
   $$Yes. You may access online resources from anywhere by logging in using your APC credentials.$$,
   'https://library.apc.edu.ph/faqs'),
  ('35736454-4887-439f-ba78-7ca535da5931', 'faq', 'rules', 'Can I download e-Books?',
   $$The APC Library does not offer e-book downloads, in compliance with copyright and intellectual property regulations. Access e-book content through the e-book platform.$$,
   'https://library.apc.edu.ph/faqs'),
  ('67631985-cf7b-4d5e-a6e2-481b9d08fb61', 'faq', 'services', 'How to access the online library?',
   $$Visit https://library.apc.edu.ph/ and log in using your APC credentials (the same password as your APC Microsoft 365 account). Search by title, author, or topic, then click "Go" to check resources in the collection.$$,
   'https://library.apc.edu.ph/faqs'),
  ('127dd1f4-4d49-444a-9793-8d1cce6d9f7a', 'faq', 'services', 'How can I view the e-resources in the online library?',
   $$Visit https://library.apc.edu.ph/ and log in using your APC credentials (the same password as your APC Microsoft 365 account). Search by title, author, or topic, then click "Go" to view resources. For assistance, email library@apc.edu.ph.$$,
   'https://library.apc.edu.ph/faqs'),
  ('3d14fc29-ff95-4b36-9c74-72f72586d524', 'faq', 'rules', 'Can APC Alumni borrow books?',
   $$APC alumni may use library materials within the APC Library premises only. Present your alumni ID to the Librarian-in-charge.$$,
   'https://library.apc.edu.ph/faqs'),
  ('59569acd-2ad6-4722-b4fe-e1bee12e09f3', 'faq', 'services', 'Can I request a library instruction for my class? (For Full-Time & Adjunct Lecturer)',
   $$Yes. A library instruction session may be scheduled upon request by APC full-time faculty and Adjunct Lecturers. The session may be onsite or on hyflex mode. To request a library instruction session, fill out the Library Instruction Request Form on the FAQ page.$$,
   'https://library.apc.edu.ph/faqs'),
  ('ff4b0aa4-ee3b-4627-bb25-40a0dd508074', 'faq', 'services', 'Can you help me with referencing?',
   $$Refer to Online Bibliography & Citation Tools: https://library.apc.edu.ph/research-guides/citation-tools$$,
   'https://library.apc.edu.ph/faqs'),
  ('3df66112-aebb-4fc6-b4ec-6773fe349011', 'faq', 'services', 'I cannot go on-site, do you have book scanning service?',
   $$See the APC Library Scanning Service: https://library.apc.edu.ph/services/scanning$$,
   'https://library.apc.edu.ph/faqs')
on conflict (id) do nothing;

commit;
