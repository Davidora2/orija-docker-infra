import type { Dialect } from "@/lib/types";

export const dialects: Dialect[] = [
  {
    id: "haitian-creole",
    name: "Haitian Creole",
    nativeName: "Kreyòl Ayisyen",
    region: "Haiti · Caribbean",
    flagEmoji: "🇭🇹",
    accent: "#0B7A75",
    blurb: "The heartbeat of Haiti — greetings, market talk, and everyday warmth.",
    learners: "2.1M diaspora learners",
    units: [
      {
        id: "hc-u1",
        title: "Bonjou",
        description: "Greet people the Haitian way",
        lessons: [
          {
            id: "hc-u1-l1",
            title: "Say hello",
            description: "Morning and daytime greetings",
            xp: 20,
            culturalNote:
              "Bonjou is used until about noon; after that, switch to bonswa. A warm greeting opens every conversation.",
            exercises: [
              {
                id: "hc1",
                type: "multiple_choice",
                prompt: "How do you say “Good morning” in Haitian Creole?",
                options: ["Bonjou", "Bonswa", "Mèsi", "Orevwa"],
                answer: "Bonjou",
                tip: "Bonjou = good day / good morning",
              },
              {
                id: "hc2",
                type: "translate",
                direction: "to_english",
                prompt: "Bonswa",
                answer: "Good evening",
                acceptedAnswers: ["good evening", "good night", "evening"],
              },
              {
                id: "hc3",
                type: "fill_blank",
                prompt: "Complete the greeting",
                sentence: "___ , kijan ou ye?",
                blank: "Bonjou",
                options: ["Bonjou", "Mèsi", "Wi", "Non"],
              },
              {
                id: "hc4",
                type: "match_pairs",
                prompt: "Match the greetings",
                pairs: [
                  { left: "Bonjou", right: "Good morning" },
                  { left: "Bonswa", right: "Good evening" },
                  { left: "Orevwa", right: "Goodbye" },
                  { left: "Mèsi", right: "Thank you" },
                ],
              },
            ],
          },
          {
            id: "hc-u1-l2",
            title: "How are you?",
            description: "Ask and answer about wellbeing",
            xp: 25,
            culturalNote:
              "Kijan ou ye? is friendly and everyday. A common reply is Mwen byen, e ou menm?",
            exercises: [
              {
                id: "hc5",
                type: "multiple_choice",
                prompt: "What does “Kijan ou ye?” mean?",
                options: [
                  "How are you?",
                  "Where are you?",
                  "What is your name?",
                  "See you later",
                ],
                answer: "How are you?",
              },
              {
                id: "hc6",
                type: "translate",
                direction: "to_dialect",
                prompt: "I am fine",
                answer: "Mwen byen",
                acceptedAnswers: ["mwen byen", "mwen byen.", "m'ap byen"],
              },
              {
                id: "hc7",
                type: "fill_blank",
                prompt: "Reply politely",
                sentence: "Mwen byen, e ou ___?",
                blank: "menm",
                options: ["menm", "bonjou", "manje", "kay"],
              },
              {
                id: "hc8",
                type: "multiple_choice",
                prompt: "Pick the Creole for “And you?”",
                options: ["E ou menm?", "Kote ou ye?", "Sa k pase?", "Ann ale"],
                answer: "E ou menm?",
              },
            ],
          },
          {
            id: "hc-u1-l3",
            title: "Names & courtesy",
            description: "Introduce yourself with respect",
            xp: 25,
            exercises: [
              {
                id: "hc9",
                type: "translate",
                direction: "to_dialect",
                prompt: "My name is Marie",
                answer: "Non mwen se Marie",
                acceptedAnswers: [
                  "non mwen se marie",
                  "mwen rele marie",
                  "yo rele m marie",
                ],
              },
              {
                id: "hc10",
                type: "multiple_choice",
                prompt: "“Tanpri” means…",
                options: ["Please", "Sorry", "Maybe", "Later"],
                answer: "Please",
              },
              {
                id: "hc11",
                type: "match_pairs",
                prompt: "Match courtesy words",
                pairs: [
                  { left: "Mèsi", right: "Thank you" },
                  { left: "Tanpri", right: "Please" },
                  { left: "Padon", right: "Sorry / excuse me" },
                  { left: "Wi", right: "Yes" },
                ],
              },
              {
                id: "hc12",
                type: "fill_blank",
                prompt: "Ask someone’s name",
                sentence: "Kijan ___ rele?",
                blank: "ou",
                options: ["ou", "li", "nou", "yo"],
              },
            ],
          },
        ],
      },
      {
        id: "hc-u2",
        title: "Lakay",
        description: "Home, family, and daily life",
        lessons: [
          {
            id: "hc-u2-l1",
            title: "Family words",
            description: "Talk about the people you love",
            xp: 30,
            culturalNote:
              "Family is central in Haitian life — expect questions about manman, papa, and pitit early in a friendship.",
            exercises: [
              {
                id: "hc13",
                type: "match_pairs",
                prompt: "Match family terms",
                pairs: [
                  { left: "Manman", right: "Mother" },
                  { left: "Papa", right: "Father" },
                  { left: "Frè", right: "Brother" },
                  { left: "Sè", right: "Sister" },
                ],
              },
              {
                id: "hc14",
                type: "multiple_choice",
                prompt: "“Pitit” means…",
                options: ["Child", "House", "Food", "Friend"],
                answer: "Child",
              },
              {
                id: "hc15",
                type: "translate",
                direction: "to_english",
                prompt: "Sa se fanmi mwen",
                answer: "This is my family",
                acceptedAnswers: ["this is my family", "that's my family"],
              },
              {
                id: "hc16",
                type: "fill_blank",
                prompt: "Talk about home",
                sentence: "Mwen rete nan ___ mwen.",
                blank: "kay",
                options: ["kay", "maché", "lekòl", "lari"],
              },
            ],
          },
          {
            id: "hc-u2-l2",
            title: "At the market",
            description: "Buy fruit, bargain, and thank the vendor",
            xp: 30,
            exercises: [
              {
                id: "hc17",
                type: "multiple_choice",
                prompt: "“Konbyen?” asks…",
                options: ["How much?", "Where?", "When?", "Who?"],
                answer: "How much?",
              },
              {
                id: "hc18",
                type: "translate",
                direction: "to_dialect",
                prompt: "I want mango",
                answer: "Mwen vle mango",
                acceptedAnswers: ["mwen vle mango", "m'ap chèche mango"],
              },
              {
                id: "hc19",
                type: "fill_blank",
                prompt: "Be polite at the stall",
                sentence: "___, ban m yon mango.",
                blank: "Tanpri",
                options: ["Tanpri", "Orevwa", "Non", "Pitit"],
              },
              {
                id: "hc20",
                type: "match_pairs",
                prompt: "Market essentials",
                pairs: [
                  { left: "Manje", right: "Food" },
                  { left: "Dlo", right: "Water" },
                  { left: "Maché", right: "Market" },
                  { left: "Lajan", right: "Money" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "jamaican-patois",
    name: "Jamaican Patois",
    nativeName: "Jamiekan Patwa",
    region: "Jamaica · Caribbean",
    flagEmoji: "🇯🇲",
    accent: "#1B8A4A",
    blurb: "Irie vibes — yard talk, respect, and island rhythm in every phrase.",
    learners: "1.8M diaspora learners",
    units: [
      {
        id: "jp-u1",
        title: "Wah gwaan",
        description: "Open with real Jamaican greetings",
        lessons: [
          {
            id: "jp-u1-l1",
            title: "Yard greetings",
            description: "Wah gwaan and warm replies",
            xp: 20,
            culturalNote:
              "Wah gwaan (what’s going on) is the classic opener. Mi deh yah means “I’m here / I’m good.”",
            exercises: [
              {
                id: "jp1",
                type: "multiple_choice",
                prompt: "What does “Wah gwaan?” mean?",
                options: [
                  "What's going on?",
                  "Where is the beach?",
                  "How much is it?",
                  "Good night",
                ],
                answer: "What's going on?",
              },
              {
                id: "jp2",
                type: "translate",
                direction: "to_english",
                prompt: "Mi deh yah",
                answer: "I'm here / I'm good",
                acceptedAnswers: [
                  "i'm here",
                  "im here",
                  "i am here",
                  "i'm good",
                  "im good",
                  "i'm alright",
                ],
              },
              {
                id: "jp3",
                type: "fill_blank",
                prompt: "Reply to a greeting",
                sentence: "Wah gwaan? ___ deh yah.",
                blank: "Mi",
                options: ["Mi", "Yu", "Dem", "Wi"],
              },
              {
                id: "jp4",
                type: "match_pairs",
                prompt: "Match the vibes",
                pairs: [
                  { left: "Irie", right: "All good / nice" },
                  { left: "Likkle more", right: "See you later" },
                  { left: "Respect", right: "Respect / thanks" },
                  { left: "Bless up", right: "Blessings / goodbye" },
                ],
              },
            ],
          },
          {
            id: "jp-u1-l2",
            title: "People & pronouns",
            description: "Mi, yu, wi, dem",
            xp: 25,
            exercises: [
              {
                id: "jp5",
                type: "match_pairs",
                prompt: "Match pronouns",
                pairs: [
                  { left: "Mi", right: "I / me" },
                  { left: "Yu", right: "You" },
                  { left: "Wi", right: "We" },
                  { left: "Dem", right: "They / them" },
                ],
              },
              {
                id: "jp6",
                type: "multiple_choice",
                prompt: "“Yuh name?” is asking…",
                options: [
                  "What's your name?",
                  "Where do you live?",
                  "Are you hungry?",
                  "How old are you?",
                ],
                answer: "What's your name?",
              },
              {
                id: "jp7",
                type: "translate",
                direction: "to_dialect",
                prompt: "My name is Kamau",
                answer: "Mi name Kamau",
                acceptedAnswers: ["mi name kamau", "mi name a kamau"],
              },
              {
                id: "jp8",
                type: "fill_blank",
                prompt: "Introduce a friend",
                sentence: "___ a mi fren.",
                blank: "Dis",
                options: ["Dis", "Dat", "Wah", "Nuh"],
              },
            ],
          },
          {
            id: "jp-u1-l3",
            title: "Feel irie",
            description: "Talk about how you feel",
            xp: 25,
            exercises: [
              {
                id: "jp9",
                type: "multiple_choice",
                prompt: "If everything is fine, you feel…",
                options: ["Irie", "Vex", "Hungry", "Late"],
                answer: "Irie",
              },
              {
                id: "jp10",
                type: "translate",
                direction: "to_english",
                prompt: "Mi feel good",
                answer: "I feel good",
                acceptedAnswers: ["i feel good", "i'm feeling good"],
              },
              {
                id: "jp11",
                type: "fill_blank",
                prompt: "Ask how someone feels",
                sentence: "How ___ feel?",
                blank: "yuh",
                options: ["yuh", "dem", "wi", "it"],
              },
              {
                id: "jp12",
                type: "match_pairs",
                prompt: "Everyday feelings",
                pairs: [
                  { left: "Hungry", right: "Hungry" },
                  { left: "Tired", right: "Tired" },
                  { left: "Happy", right: "Happy" },
                  { left: "Vex", right: "Upset / angry" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "jp-u2",
        title: "Food & yard",
        description: "Eat, share, and talk home",
        lessons: [
          {
            id: "jp-u2-l1",
            title: "Ital & plate",
            description: "Food words you’ll actually use",
            xp: 30,
            culturalNote:
              "Ital food comes from Rastafari culture — natural, often plant-based. Food talk is love talk in Jamaica.",
            exercises: [
              {
                id: "jp13",
                type: "multiple_choice",
                prompt: "“Nyam” means…",
                options: ["Eat", "Sleep", "Run", "Sing"],
                answer: "Eat",
              },
              {
                id: "jp14",
                type: "translate",
                direction: "to_dialect",
                prompt: "I want food",
                answer: "Mi want food",
                acceptedAnswers: ["mi want food", "mi waan food", "mi want nyam"],
              },
              {
                id: "jp15",
                type: "match_pairs",
                prompt: "Match the plate",
                pairs: [
                  { left: "Ackee", right: "National fruit dish" },
                  { left: "Bammy", right: "Cassava flatbread" },
                  { left: "Jerk", right: "Spicy grilled style" },
                  { left: "Sorrel", right: "Festive drink" },
                ],
              },
              {
                id: "jp16",
                type: "fill_blank",
                prompt: "Invite someone to eat",
                sentence: "Come ___ wid mi.",
                blank: "nyam",
                options: ["nyam", "gwaan", "vex", "run"],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "nigerian-pidgin",
    name: "Nigerian Pidgin",
    nativeName: "Naija",
    region: "Nigeria · West Africa",
    flagEmoji: "🇳🇬",
    accent: "#C45C26",
    blurb: "Naija no dey carry last — street-smart phrases for diaspora reconnection.",
    learners: "3.4M diaspora learners",
    units: [
      {
        id: "np-u1",
        title: "How far",
        description: "Greet like a true Naija",
        lessons: [
          {
            id: "np-u1-l1",
            title: "How far?",
            description: "The everyday Nigerian hello",
            xp: 20,
            culturalNote:
              "How far? is the universal soft greeting — less formal than “How are you?” and perfect for friends and strangers alike.",
            exercises: [
              {
                id: "np1",
                type: "multiple_choice",
                prompt: "“How far?” is mainly used as…",
                options: [
                  "A casual hello",
                  "A demand for distance",
                  "A goodbye",
                  "A prayer",
                ],
                answer: "A casual hello",
              },
              {
                id: "np2",
                type: "translate",
                direction: "to_english",
                prompt: "I dey kampe",
                answer: "I'm fine / I'm good",
                acceptedAnswers: [
                  "i'm fine",
                  "im fine",
                  "i am fine",
                  "i'm good",
                  "im good",
                  "i am good",
                ],
              },
              {
                id: "np3",
                type: "fill_blank",
                prompt: "Reply casually",
                sentence: "How far? I dey ___.",
                blank: "kampe",
                options: ["kampe", "waka", "chop", "sharp"],
              },
              {
                id: "np4",
                type: "match_pairs",
                prompt: "Match Naija greetings",
                pairs: [
                  { left: "How far?", right: "What's up / hello" },
                  { left: "Abeg", right: "Please / I beg" },
                  { left: "Oya", right: "Come on / hurry" },
                  { left: "Sharp sharp", right: "Quickly / okay" },
                ],
              },
            ],
          },
          {
            id: "np-u1-l2",
            title: "You & me",
            description: "I, you, we, dem",
            xp: 25,
            exercises: [
              {
                id: "np5",
                type: "match_pairs",
                prompt: "Match the pronouns",
                pairs: [
                  { left: "I", right: "I" },
                  { left: "You", right: "You" },
                  { left: "We", right: "We" },
                  { left: "Dem", right: "They" },
                ],
              },
              {
                id: "np6",
                type: "multiple_choice",
                prompt: "“Wetin be your name?” means…",
                options: [
                  "What is your name?",
                  "Where do you stay?",
                  "What do you eat?",
                  "Who is that?",
                ],
                answer: "What is your name?",
              },
              {
                id: "np7",
                type: "translate",
                direction: "to_dialect",
                prompt: "My name is Ada",
                answer: "My name na Ada",
                acceptedAnswers: ["my name na ada", "dem dey call me ada"],
              },
              {
                id: "np8",
                type: "fill_blank",
                prompt: "Point someone out",
                sentence: "___ be my padi.",
                blank: "Na",
                options: ["Na", "No", "Dey", "Fit"],
              },
            ],
          },
          {
            id: "np-u1-l3",
            title: "Abeg & manners",
            description: "Polite Pidgin that still sounds natural",
            xp: 25,
            exercises: [
              {
                id: "np9",
                type: "multiple_choice",
                prompt: "“Abeg” softens a request like…",
                options: ["Please", "Never", "Tomorrow", "Money"],
                answer: "Please",
              },
              {
                id: "np10",
                type: "translate",
                direction: "to_english",
                prompt: "Thank you plenty",
                answer: "Thank you very much",
                acceptedAnswers: [
                  "thank you very much",
                  "thanks a lot",
                  "thank you a lot",
                ],
              },
              {
                id: "np11",
                type: "fill_blank",
                prompt: "Ask kindly",
                sentence: "___, help me.",
                blank: "Abeg",
                options: ["Abeg", "Oya", "Wahala", "Chop"],
              },
              {
                id: "np12",
                type: "match_pairs",
                prompt: "Manners & mood",
                pairs: [
                  { left: "No wahala", right: "No problem" },
                  { left: "Sorry o", right: "I'm sorry" },
                  { left: "Well done", right: "Good job / hello" },
                  { left: "E don do", right: "That's enough" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "np-u2",
        title: "Chop life",
        description: "Food, movement, and daily hustle",
        lessons: [
          {
            id: "np-u2-l1",
            title: "Chop time",
            description: "Talk hunger and favorite plates",
            xp: 30,
            culturalNote:
              "Chop means eat. Sharing food — jollof, suya, puff-puff — is how community shows love across Naija diaspora kitchens.",
            exercises: [
              {
                id: "np13",
                type: "multiple_choice",
                prompt: "“I wan chop” means…",
                options: [
                  "I want to eat",
                  "I want to sleep",
                  "I want to leave",
                  "I want money",
                ],
                answer: "I want to eat",
              },
              {
                id: "np14",
                type: "translate",
                direction: "to_dialect",
                prompt: "The food is sweet",
                answer: "The food sweet",
                acceptedAnswers: ["the food sweet", "di food sweet", "food sweet"],
              },
              {
                id: "np15",
                type: "match_pairs",
                prompt: "Match the meal talk",
                pairs: [
                  { left: "Hungry", right: "Hungry" },
                  { left: "Belly full", right: "Satisfied" },
                  { left: "Suya", right: "Spiced grilled meat" },
                  { left: "Jollof", right: "Celebrated rice dish" },
                ],
              },
              {
                id: "np16",
                type: "fill_blank",
                prompt: "Invite someone",
                sentence: "Come make we ___.",
                blank: "chop",
                options: ["chop", "waka", "shout", "sleep"],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "trinidadian-creole",
    name: "Trinidadian Creole",
    nativeName: "Trini Talk",
    region: "Trinidad & Tobago · Caribbean",
    flagEmoji: "🇹🇹",
    accent: "#C8102E",
    blurb: "Lime, laugh, and learn the sweetest island English Creole.",
    learners: "920K diaspora learners",
    units: [
      {
        id: "tt-u1",
        title: "Waz de scene",
        description: "Trini hellos and lime culture",
        lessons: [
          {
            id: "tt-u1-l1",
            title: "Waz de scene",
            description: "Open a Trini conversation",
            xp: 20,
            culturalNote:
              "A lime is a hangout — no agenda, pure vibes. Asking waz de scene? is how you check in.",
            exercises: [
              {
                id: "tt1",
                type: "multiple_choice",
                prompt: "“Waz de scene?” means…",
                options: [
                  "What's going on?",
                  "Where is the stage?",
                  "What time is carnival?",
                  "Who cooked?",
                ],
                answer: "What's going on?",
              },
              {
                id: "tt2",
                type: "translate",
                direction: "to_english",
                prompt: "Everything nice",
                answer: "Everything is good",
                acceptedAnswers: [
                  "everything is good",
                  "everything's good",
                  "all is well",
                  "everything nice",
                ],
              },
              {
                id: "tt3",
                type: "fill_blank",
                prompt: "Suggest hanging out",
                sentence: "Allyuh want to ___ later?",
                blank: "lime",
                options: ["lime", "bake", "rush", "hide"],
              },
              {
                id: "tt4",
                type: "match_pairs",
                prompt: "Match Trini talk",
                pairs: [
                  { left: "Lime", right: "Hang out" },
                  { left: "Allyuh", right: "All of you" },
                  { left: "Eh-eh", right: "Expression of surprise" },
                  { left: "Gyul", right: "Girl" },
                ],
              },
            ],
          },
          {
            id: "tt-u1-l2",
            title: "Sweet talk",
            description: "Compliments and everyday warmth",
            xp: 25,
            exercises: [
              {
                id: "tt5",
                type: "multiple_choice",
                prompt: "If food is delicious, Trinis say it…",
                options: ["Sweet", "Cold", "Loud", "Blue"],
                answer: "Sweet",
              },
              {
                id: "tt6",
                type: "translate",
                direction: "to_dialect",
                prompt: "The roti is delicious",
                answer: "De roti sweet",
                acceptedAnswers: ["de roti sweet", "the roti sweet", "roti sweet"],
              },
              {
                id: "tt7",
                type: "fill_blank",
                prompt: "Check on a friend",
                sentence: "How you ___?",
                blank: "goin",
                options: ["goin", "cookin", "limin", "jumpin"],
              },
              {
                id: "tt8",
                type: "match_pairs",
                prompt: "Food & feeling",
                pairs: [
                  { left: "Doubles", right: "Street food classic" },
                  { left: "Pelau", right: "Rice & meat one-pot" },
                  { left: "Bake", right: "Fried bread" },
                  { left: "Sweet drink", right: "Soda / soft drink" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "ghanaian-pidgin",
    name: "Ghanaian Pidgin",
    nativeName: "Gh Pidgin",
    region: "Ghana · West Africa",
    flagEmoji: "🇬🇭",
    accent: "#CFB53B",
    blurb: "Chale — connect with Accra energy and diaspora homecomings.",
    learners: "1.1M diaspora learners",
    units: [
      {
        id: "gp-u1",
        title: "Chale",
        description: "Greetings with Ghanaian warmth",
        lessons: [
          {
            id: "gp-u1-l1",
            title: "Chale basics",
            description: "The friendliest opener in Gh Pidgin",
            xp: 20,
            culturalNote:
              "Chale (or Charlie) is the all-purpose buddy word — soft, familiar, and everywhere in Ghanaian conversation.",
            exercises: [
              {
                id: "gp1",
                type: "multiple_choice",
                prompt: "“Chale” is closest to…",
                options: ["Buddy / mate", "Teacher", "Money", "Tomorrow"],
                answer: "Buddy / mate",
              },
              {
                id: "gp2",
                type: "translate",
                direction: "to_english",
                prompt: "You dey?",
                answer: "Are you there? / How are you?",
                acceptedAnswers: [
                  "are you there",
                  "how are you",
                  "you around",
                  "are you around",
                ],
              },
              {
                id: "gp3",
                type: "fill_blank",
                prompt: "Answer that you’re fine",
                sentence: "I dey ___.",
                blank: "fine",
                options: ["fine", "go", "come", "pay"],
              },
              {
                id: "gp4",
                type: "match_pairs",
                prompt: "Match Gh Pidgin",
                pairs: [
                  { left: "Chale", right: "Friend / hey" },
                  { left: "Please", right: "Please" },
                  { left: "Medaase", right: "Thank you (Twi loan)" },
                  { left: "I dey come", right: "I'm on my way" },
                ],
              },
            ],
          },
          {
            id: "gp-u1-l2",
            title: "Make we go",
            description: "Plans, movement, and meetups",
            xp: 25,
            exercises: [
              {
                id: "gp5",
                type: "multiple_choice",
                prompt: "“Make we go” means…",
                options: [
                  "Let's go",
                  "Don't go",
                  "Go alone",
                  "Stay home",
                ],
                answer: "Let's go",
              },
              {
                id: "gp6",
                type: "translate",
                direction: "to_dialect",
                prompt: "I am coming",
                answer: "I dey come",
                acceptedAnswers: ["i dey come", "i go come"],
              },
              {
                id: "gp7",
                type: "fill_blank",
                prompt: "Suggest a plan",
                sentence: "Make we ___ chop.",
                blank: "go",
                options: ["go", "sit", "cry", "forget"],
              },
              {
                id: "gp8",
                type: "match_pairs",
                prompt: "Daily movement",
                pairs: [
                  { left: "I dey go", right: "I'm leaving / going" },
                  { left: "Wait small", right: "Wait a bit" },
                  { left: "Where you dey?", right: "Where are you?" },
                  { left: "I reach", right: "I've arrived" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "cape-verdean",
    name: "Cape Verdean Creole",
    nativeName: "Kriolu",
    region: "Cabo Verde · Atlantic Africa",
    flagEmoji: "🇨🇻",
    accent: "#003893",
    blurb: "Morabeza spirit — soft Kriolu for islands and diaspora homes.",
    learners: "640K diaspora learners",
    units: [
      {
        id: "cv-u1",
        title: "Morabeza",
        description: "Warmth, greetings, and belonging",
        lessons: [
          {
            id: "cv-u1-l1",
            title: "Bon dia",
            description: "Start the day in Kriolu",
            xp: 20,
            culturalNote:
              "Morabeza is Cape Verde’s hospitality ethos — openness, warmth, and making people feel at home.",
            exercises: [
              {
                id: "cv1",
                type: "multiple_choice",
                prompt: "“Bon dia” means…",
                options: ["Good morning", "Good night", "See you", "Please"],
                answer: "Good morning",
              },
              {
                id: "cv2",
                type: "translate",
                direction: "to_english",
                prompt: "Nha nomi é Lucia",
                answer: "My name is Lucia",
                acceptedAnswers: ["my name is lucia", "my name's lucia"],
              },
              {
                id: "cv3",
                type: "fill_blank",
                prompt: "Ask how someone is",
                sentence: "Modi ___ sta?",
                blank: "bu",
                options: ["bu", "nha", "nos", "es"],
              },
              {
                id: "cv4",
                type: "match_pairs",
                prompt: "Match Kriolu basics",
                pairs: [
                  { left: "Obrigadu", right: "Thank you (m)" },
                  { left: "Por favor", right: "Please" },
                  { left: "Txau", right: "Bye" },
                  { left: "Bon noti", right: "Good night" },
                ],
              },
            ],
          },
          {
            id: "cv-u1-l2",
            title: "Familia",
            description: "People closest to home",
            xp: 25,
            exercises: [
              {
                id: "cv5",
                type: "match_pairs",
                prompt: "Family in Kriolu",
                pairs: [
                  { left: "Mai", right: "Mother" },
                  { left: "Pai", right: "Father" },
                  { left: "Ermon", right: "Brother" },
                  { left: "Erma", right: "Sister" },
                ],
              },
              {
                id: "cv6",
                type: "multiple_choice",
                prompt: "“Nha kasa” means…",
                options: ["My house", "My boat", "My song", "My school"],
                answer: "My house",
              },
              {
                id: "cv7",
                type: "translate",
                direction: "to_dialect",
                prompt: "I am well",
                answer: "N sta dretu",
                acceptedAnswers: ["n sta dretu", "n sta bem", "n ta bem"],
              },
              {
                id: "cv8",
                type: "fill_blank",
                prompt: "Speak about home",
                sentence: "N mora na nha ___.",
                blank: "kasa",
                options: ["kasa", "mar", "festa", "praia"],
              },
            ],
          },
        ],
      },
    ],
  },
];

export function getDialect(id: string): Dialect | undefined {
  return dialects.find((d) => d.id === id);
}

export function getLesson(
  dialectId: string,
  lessonId: string,
): { dialect: Dialect; lesson: import("@/lib/types").Lesson; unitTitle: string } | null {
  const dialect = getDialect(dialectId);
  if (!dialect) return null;
  for (const unit of dialect.units) {
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (lesson) return { dialect, lesson, unitTitle: unit.title };
  }
  return null;
}

export function getAllLessons(dialect: Dialect) {
  return dialect.units.flatMap((unit) =>
    unit.lessons.map((lesson, index) => ({
      lesson,
      unit,
      indexInPath: dialect.units
        .slice(0, dialect.units.indexOf(unit))
        .reduce((n, u) => n + u.lessons.length, 0) + index,
    })),
  );
}
