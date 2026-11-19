// Snapshot of https://library.apc.edu.ph/faqs retrieved on 2026-11-19.
// Refresh this file from the official FAQ page when its guidance changes.
export interface FaqEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export const FAQ_SOURCE_URL = 'https://library.apc.edu.ph/faqs';

export const FAQS: FaqEntry[] = [
  {
    id: 'access-location',
    category: 'Access',
    question: 'Where is the APC Library located?',
    answer: 'The APC Library is located at the 7th Floor Building, 3 Humabon Place, Magallanes, Makati City.',
  },
  {
    id: 'access-contact',
    category: 'Access',
    question: 'How can I contact the library?',
    answer: 'Email: library@apc.edu.ph\nFacebook: Asia Pacific College Library (https://www.facebook.com/AsiaPacificCollegeLibrary)\nTelephone: +63 2 8852 9232 / Local 406 or 407',
  },
  {
    id: 'access-visiting-researchers',
    category: 'Access',
    question: 'Do you accept visiting researchers?',
    answer: `Yes, visiting researchers are welcome at the APC Library.
Requirements:
- On the date of your visit, bring a valid school/university/company ID, a copy or screenshot of the email approval, and present the referral letter from your office/school head librarian requesting the privilege to use the APC Library along with their authorized signature.
- Fill out the Visiting Researcher Form: https://forms.office.com/pages/responsepage.aspx?id=5kW3rmaBj0-SMxeegQnEntqUwPFEdc1BtaFdoW5krGBUNTE0MlhPMUhGWEo2UE1OV0E2UEFBTEpIQy4u&route=shorturl
Fees:
- APC Alumni: Free of charge (present an updated alumni ID).
- Consortium Partners (all NU campuses): Free of charge.
- Graduate/undergraduate students from other schools or institutions: Php 50.00 per visit.
- Private and government researchers: Php 100.00 per visit.
See Guidelines for Visitors and Non-APC Researchers: https://library.apc.edu.ph/cgi-bin/koha/pages.pl?p=guidelines-for-non-apc-researchers`,
  },
  {
    id: 'access-eating',
    category: 'Access',
    question: 'Can I eat or drink inside the library?',
    answer: 'Eating is not allowed in the main library and open discussion area. Students caught eating or drinking in these areas will be reported to the Discipline Office.',
  },
  {
    id: 'access-charging',
    category: 'Access',
    question: 'Do you allow charging of electronic devices inside the library?',
    answer: 'Charging of electronic devices is allowed inside the library.',
  },
  {
    id: 'access-wifi',
    category: 'Access',
    question: 'How do I access Wi-Fi inside the library?',
    answer: 'Connect your electronic device to "WiFi-Library" and ask the librarian-in-charge for the password.',
  },
  {
    id: 'borrow-limit',
    category: 'Borrowing',
    question: 'How many books I can borrow?',
    answer: 'There is no limit on the number of books that may be borrowed.',
  },
  {
    id: 'borrow-fine',
    category: 'Borrowing',
    question: 'How much is the library fine?',
    answer: 'The APC Library has a penalty of Php 20.00 per book, per day for late returns.',
  },
  {
    id: 'borrow-days',
    category: 'Borrowing',
    question: 'How many days can I borrow a book?',
    answer: `Students:
- CFP Collection/Circulation/Filipiniana Section: 14 days.
- Reserve Section: 1 day.
- Reference/Periodicals/Special Collection: for use within the APC Library only.
Full-Time and Adjunct Lecturers:
- CFP Collection/Circulation/Filipiniana Section: 14 days.
- Reserve Section: 7 days.
- Reference/Periodicals/Special Collection: for use within the APC Library only.`,
  },
  {
    id: 'borrow-renew-onsite',
    category: 'Borrowing',
    question: 'Can I renew borrowed books?',
    answer: 'Yes. Go to the APC Library and ask the Librarian-in-charge to renew your borrowed books.',
  },
  {
    id: 'borrow-renew-online',
    category: 'Borrowing',
    question: 'Can I renew borrowed books online?',
    answer: `Yes. Email library@apc.edu.ph with your full name, the title(s) of the book(s), and the book barcode (on the back of the book). You may also send images of the front and back of the book(s). You can message the librarians via MS Teams; see the Organizational Structure: https://library.apc.edu.ph/about/organizational-structure`,
  },
  {
    id: 'borrow-theses',
    category: 'Borrowing',
    question: 'How do I borrow theses papers?',
    answer: 'Go to the main library and ask the Librarian-in-charge for the list of theses by school. Scan the QR code and fill out the form. Theses papers are for viewing/reading within the APC Library premises only.',
  },
  {
    id: 'borrow-overdue-fines',
    category: 'Borrowing',
    question: 'I have an overdue book/s, how do I pay my fines?',
    answer: 'After you have returned your overdue item, fines will be computed and indicated in an overdue slip issued by the Librarian-in-charge. Proceed to the Finance Office (4th floor) and pay the indicated amount. Go back to the library to present the official receipt to the librarian. The Librarian will process and clear your library overdue fine in the library system. You will receive an email from the APC Library regarding the confirmation of your payment. For further assistance, email library@apc.edu.ph.',
  },
  {
    id: 'borrow-ebooks',
    category: 'Borrowing',
    question: 'How do I access E-Books?',
    answer: 'There are two types of e-books accessible online in the APC Library: Library subscription e-books and e-books available through APC’s Online Catalog. To access subscription e-books, visit the Koha Online Catalog: https://library.apc.edu.ph/. For e-books available through APC’s Online Catalog, search by title, author, or subject in the Koha OPAC. For more details, refer to the Guide to E-Books.',
  },
  {
    id: 'resources-home-access',
    category: 'Resources',
    question: 'Can I access online resources from home?',
    answer: 'Yes. You may access online resources from anywhere by logging in using your APC credentials.',
  },
  {
    id: 'resources-download-ebooks',
    category: 'Resources',
    question: 'Can I download e-Books?',
    answer: 'The APC Library does not offer e-book downloads, in compliance with copyright and intellectual property regulations. Access e-book content through the e-book platform.',
  },
  {
    id: 'resources-access-online-library',
    category: 'Resources',
    question: 'How to access the online library?',
    answer: 'Visit https://library.apc.edu.ph/ and log in using your APC credentials (the same password as your APC Microsoft 365 account). Search by title, author, or topic, then click "Go" to check resources in the collection.',
  },
  {
    id: 'resources-view-e-resources',
    category: 'Resources',
    question: 'How can I view the e-resources in the online library?',
    answer: 'Visit https://library.apc.edu.ph/ and log in using your APC credentials (the same password as your APC Microsoft 365 account). Search by title, author, or topic, then click "Go" to view resources. For assistance, email library@apc.edu.ph.',
  },
  {
    id: 'resources-alumni-borrow',
    category: 'Resources',
    question: 'Can APC Alumni borrow books?',
    answer: 'APC alumni may use library materials within the APC Library premises only. Present your alumni ID to the Librarian-in-charge.',
  },
  {
    id: 'services-library-instruction',
    category: 'Services',
    question: 'Can I request a library instruction for my class? (For Full-Time & Adjunct Lecturer)',
    answer: 'Yes. A library instruction session may be scheduled upon request by APC full-time faculty and Adjunct Lecturers. The session may be onsite or on hyflex mode. To request a library instruction session, fill out the Library Instruction Request Form on the FAQ page.',
  },
  {
    id: 'services-referencing',
    category: 'Services',
    question: 'Can you help me with referencing?',
    answer: 'Refer to Online Bibliography & Citation Tools: https://library.apc.edu.ph/research-guides/citation-tools',
  },
  {
    id: 'services-scanning',
    category: 'Services',
    question: 'I cannot go on-site, do you have book scanning service?',
    answer: 'See the APC Library Scanning Service: https://library.apc.edu.ph/services/scanning',
  },
];
