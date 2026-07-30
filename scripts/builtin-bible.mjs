/** Fallback sermon corpus when network Bible download fails. */
export const BUILTIN = {
  translation: 'WEB',
  books: [
    {
      name: 'Genesis',
      chapters: [
        {
          chapter: 1,
          verses: [
            { verse: 1, text: 'In the beginning, God created the heavens and the earth.' },
            { verse: 27, text: 'God created man in his own image. In God\'s image he created him; male and female he created them.' },
          ],
        },
      ],
    },
    {
      name: 'Psalms',
      chapters: [
        {
          chapter: 23,
          verses: [
            { verse: 1, text: 'Yahweh is my shepherd; I shall lack nothing.' },
            { verse: 2, text: 'He makes me lie down in green pastures. He leads me beside still waters.' },
            { verse: 3, text: 'He restores my soul. He guides me in the paths of righteousness for his name\'s sake.' },
            { verse: 4, text: 'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.' },
            { verse: 5, text: 'You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.' },
            { verse: 6, text: 'Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahweh\'s house forever.' },
          ],
        },
        {
          chapter: 46,
          verses: [
            { verse: 1, text: 'God is our refuge and strength, a very present help in trouble.' },
            { verse: 10, text: 'Be still, and know that I am God. I will be exalted among the nations. I will be exalted in the earth.' },
          ],
        },
      ],
    },
    {
      name: 'Proverbs',
      chapters: [
        {
          chapter: 3,
          verses: [
            { verse: 5, text: 'Trust in Yahweh with all your heart, and don\'t lean on your own understanding.' },
            { verse: 6, text: 'In all your ways acknowledge him, and he will make your paths straight.' },
          ],
        },
      ],
    },
    {
      name: 'Isaiah',
      chapters: [
        {
          chapter: 40,
          verses: [
            { verse: 31, text: 'but those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.' },
          ],
        },
        {
          chapter: 53,
          verses: [
            { verse: 5, text: 'But he was pierced for our transgressions. He was crushed for our iniquities. The punishment that brought our peace was on him; and by his wounds we are healed.' },
            { verse: 6, text: 'All we like sheep have gone astray. Everyone has turned to his own way; and Yahweh has laid on him the iniquity of us all.' },
          ],
        },
      ],
    },
    {
      name: 'Jeremiah',
      chapters: [
        {
          chapter: 29,
          verses: [
            { verse: 11, text: 'For I know the thoughts that I think toward you," says Yahweh, "thoughts of peace, and not of evil, to give you hope and a future.' },
          ],
        },
      ],
    },
    {
      name: 'Matthew',
      chapters: [
        {
          chapter: 5,
          verses: [
            { verse: 3, text: 'Blessed are the poor in spirit, for theirs is the Kingdom of Heaven.' },
            { verse: 4, text: 'Blessed are those who mourn, for they shall be comforted.' },
            { verse: 5, text: 'Blessed are the gentle, for they shall inherit the earth.' },
            { verse: 6, text: 'Blessed are those who hunger and thirst for righteousness, for they shall be filled.' },
            { verse: 14, text: 'You are the light of the world. A city located on a hill can\'t be hidden.' },
            { verse: 16, text: 'Even so, let your light shine before men, that they may see your good works and glorify your Father who is in heaven.' },
          ],
        },
        {
          chapter: 6,
          verses: [
            { verse: 9, text: 'Pray like this: "Our Father in heaven, may your name be kept holy.' },
            { verse: 10, text: 'Let your Kingdom come. Let your will be done on earth as it is in heaven.' },
            { verse: 11, text: 'Give us today our daily bread.' },
            { verse: 12, text: 'Forgive us our debts, as we also forgive our debtors.' },
            { verse: 13, text: 'Bring us not into temptation, but deliver us from the evil one. For yours is the Kingdom, the power, and the glory forever. Amen."' },
            { verse: 33, text: 'But seek first God\'s Kingdom and his righteousness; and all these things will be given to you as well.' },
          ],
        },
        {
          chapter: 28,
          verses: [
            { verse: 19, text: 'Go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit,' },
            { verse: 20, text: 'teaching them to observe all things that I commanded you. Behold, I am with you always, even to the end of the age. Amen.' },
          ],
        },
      ],
    },
    {
      name: 'John',
      chapters: [
        {
          chapter: 1,
          verses: [
            { verse: 1, text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
            { verse: 2, text: 'The same was in the beginning with God.' },
            { verse: 3, text: 'All things were made through him. Without him, nothing was made that has been made.' },
            { verse: 4, text: 'In him was life, and the life was the light of men.' },
            { verse: 5, text: 'The light shines in the darkness, and the darkness hasn\'t overcome it.' },
            { verse: 14, text: 'The Word became flesh and lived among us. We saw his glory, such glory as of the only born Son of the Father, full of grace and truth.' },
          ],
        },
        {
          chapter: 3,
          verses: [
            { verse: 16, text: 'For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.' },
            { verse: 17, text: 'For God didn\'t send his Son into the world to judge the world, but that the world should be saved through him.' },
          ],
        },
        {
          chapter: 14,
          verses: [
            { verse: 6, text: 'Jesus said to him, "I am the way, the truth, and the life. No one comes to the Father, except through me."' },
            { verse: 27, text: 'Peace I leave with you. My peace I give to you; not as the world gives, I give to you. Don\'t let your heart be troubled, neither let it be fearful.' },
          ],
        },
      ],
    },
    {
      name: 'Romans',
      chapters: [
        {
          chapter: 8,
          verses: [
            { verse: 28, text: 'We know that all things work together for good for those who love God, for those who are called according to his purpose.' },
            { verse: 38, text: 'For I am persuaded that neither death, nor life, nor angels, nor principalities, nor things present, nor things to come, nor powers,' },
            { verse: 39, text: 'nor height, nor depth, nor any other created thing will be able to separate us from God\'s love which is in Christ Jesus our Lord.' },
          ],
        },
        {
          chapter: 12,
          verses: [
            { verse: 1, text: 'Therefore I urge you, brothers, by the mercies of God, to present your bodies a living sacrifice, holy, acceptable to God, which is your spiritual service.' },
            { verse: 2, text: 'Don\'t be conformed to this world, but be transformed by the renewing of your mind, so that you may prove what is the good, well-pleasing, and perfect will of God.' },
          ],
        },
      ],
    },
    {
      name: '1 Corinthians',
      chapters: [
        {
          chapter: 13,
          verses: [
            { verse: 4, text: 'Love is patient and is kind. Love doesn\'t envy. Love doesn\'t brag, is not proud,' },
            { verse: 5, text: 'doesn\'t behave itself inappropriately, doesn\'t seek its own way, is not provoked, takes no account of evil;' },
            { verse: 6, text: 'doesn\'t rejoice in unrighteousness, but rejoices with the truth;' },
            { verse: 7, text: 'bears all things, believes all things, hopes all things, and endures all things.' },
            { verse: 8, text: 'Love never fails. But where there are prophecies, they will be done away with. Where there are various languages, they will cease. Where there is knowledge, it will be done away with.' },
            { verse: 13, text: 'But now faith, hope, and love remain—these three. The greatest of these is love.' },
          ],
        },
      ],
    },
    {
      name: 'Ephesians',
      chapters: [
        {
          chapter: 2,
          verses: [
            { verse: 8, text: 'for by grace you have been saved through faith, and that not of yourselves; it is the gift of God,' },
            { verse: 9, text: 'not of works, that no one would boast.' },
            { verse: 10, text: 'For we are his workmanship, created in Christ Jesus for good works, which God prepared before that we would walk in them.' },
          ],
        },
      ],
    },
    {
      name: 'Philippians',
      chapters: [
        {
          chapter: 4,
          verses: [
            { verse: 6, text: 'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.' },
            { verse: 7, text: 'And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.' },
            { verse: 13, text: 'I can do all things through Christ who strengthens me.' },
          ],
        },
      ],
    },
    {
      name: 'Hebrews',
      chapters: [
        {
          chapter: 11,
          verses: [
            { verse: 1, text: 'Now faith is assurance of things hoped for, proof of things not seen.' },
            { verse: 6, text: 'Without faith it is impossible to be well pleasing to him, for he who comes to God must believe that he exists, and that he is a rewarder of those who seek him.' },
          ],
        },
        {
          chapter: 12,
          verses: [
            { verse: 1, text: 'Therefore let\'s also, seeing we are surrounded by so great a cloud of witnesses, lay aside every weight and the sin which so easily entangles us, and let\'s run with perseverance the race that is set before us,' },
            { verse: 2, text: 'looking to Jesus, the author and perfecter of faith, who for the joy that was set before him endured the cross, despising its shame, and has sat down at the right hand of the throne of God.' },
          ],
        },
      ],
    },
  ],
};
