// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "1qgsbxlx-tqgq-sdma-wck1-gdjktoq6pgq",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "h6oixbev-heb0-g08f-sg13-1gsap4gg3xf",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "wb6sw96c-y7sg-un1s-yt8j-foqqr2shdt",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": true,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "n91v6fr8-f8m0-4h8g-1ads-o6qc4ciq2gi",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "rynij53u-5i74-n09d-z8r8-h8owpl7kd2",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-07-17T03:01:01.247Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "ei6cjgro-eml2-g0fo-opns-02zzrbsr0l9r",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "1dodizrc-hc7c-a16u-6h6c-e8je02gfwej",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 45,
    "userId": 26,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "accessToken": "accessToken_1",
    "expiresAt": 40,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 100,
    "userId": 88,
    "expires": "2025-07-17T03:01:01.247Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "3b0i0aly-1pds-9jqp-vy0e-jtl5i7hxqn",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 71,
    "image": "image_1"
  },
  {
    "id": 61,
    "email": "instructional@example.com",
    "image": "image_2"
  },
  {
    "id": 11,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "image": "image_3"
  },
  {
    "id": 20,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-17T03:01:01.247Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "0dyigrji-ay6p-yuik-xm8l-i1egd8o88ta",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "userId": 71,
    "lastLogin": "2025-07-17T03:01:01.247Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "role": "admin",
    "classIds": [
      "1qgsbxlx-tqgq-sdma-wck1-gdjktoq6pgq",
      "h6oixbev-heb0-g08f-sg13-1gsap4gg3xf"
    ],
    "active": true,
    "lastActive": "2025-07-17T03:01:01.247Z"
  },
  {
    "id": "ilnu44wz-vijk-zu5p-46d6-06b8eioq50qs",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "userId": 61,
    "lastLogin": "2025-07-17T03:01:01.247Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "role": "instructional",
    "classIds": [
      "1qgsbxlx-tqgq-sdma-wck1-gdjktoq6pgq",
      "h6oixbev-heb0-g08f-sg13-1gsap4gg3xf"
    ],
    "active": false,
    "lastActive": "2025-07-17T03:01:01.247Z"
  },
  {
    "id": "e8s8ujl6-cvji-pwm2-5h18-suqr850eo2",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "userId": 11,
    "lastLogin": "2025-07-17T03:01:01.247Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "role": "instructor",
    "classIds": [
      "1qgsbxlx-tqgq-sdma-wck1-gdjktoq6pgq",
      "h6oixbev-heb0-g08f-sg13-1gsap4gg3xf"
    ],
    "active": false,
    "lastActive": "2025-07-17T03:01:01.247Z"
  },
  {
    "id": "y5iami0j-652o-nu66-brss-yabwgp44h3b",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "userId": 20,
    "lastLogin": "2025-07-17T03:01:01.247Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "role": "ta",
    "classIds": [
      "1qgsbxlx-tqgq-sdma-wck1-gdjktoq6pgq",
      "h6oixbev-heb0-g08f-sg13-1gsap4gg3xf"
    ],
    "active": false,
    "lastActive": "2025-07-17T03:01:01.247Z"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "0bceq753-dyft-w5jm-uhoa-mhv4qa73bdg",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 93,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "b8u9tbwg-hpnc-pekt-g6gm-h90qwt5m86m",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 75,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "thzccg6j-ns8q-zy86-cvvz-pgzbzoo3k7d",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 79,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "x35g22lm-wwb9-5w9w-dwx1-vttney2pxyh",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 78,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 99,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-17T03:01:01.247Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 93,
    "createdAt": "2025-07-17T03:01:01.247Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "y2l1zzsy-cwle-7yw5-e1cr-kd79wg931v",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "cp7ht36f-o77n-tw38-kyza-tyyt2m2h99",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "intensity": 72,
    "seniority": "freshman",
    "tod": "9AM",
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true
  },
  {
    "id": "cwkf97gg-845u-hvw3-nw00-o3rdxfnjg8l",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "crowdedness": 15,
    "intensity": 33,
    "seniority": "sophomore",
    "location": "haas",
    "urgency": "day",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "cqw67mr2-bf16-wxvg-2xl9-zzo347qxiq",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "completedAt": "2025-07-17T03:01:01.247Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "t6zagwua-1sp2-ugei-lav9-pahl30qq7k",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "completedAt": "2025-07-17T03:01:01.247Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "o3qk69ts-9yw8-2gma-rfs8-w4smd1pkoqr",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "a8y1b5g5-ojzk-0kca-bf3b-0f4r6r4out0v",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.6,
    "defaultAgent": "defaultAgent_1",
    "editable": true,
    "modelId": "modelId_1"
  },
  {
    "id": "h757lrjm-milj-flbg-r5c9-ynm4qs60vgo",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.33,
    "defaultAgent": "defaultAgent_2",
    "editable": false,
    "reasoning": "medium"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "tnpxyuq5-y07c-a87j-gbk4-yj114l84x8",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "profileId": "profileId_1",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1",
    "footerSplit": "footerSplit_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "tibafup8-ehpm-tllb-0wjt-j7qqm1q93qb",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "0dyigrji-ay6p-yuik-xm8l-i1egd8o88ta",
      "ilnu44wz-vijk-zu5p-46d6-06b8eioq50qs",
      "e8s8ujl6-cvji-pwm2-5h18-suqr850eo2",
      "y5iami0j-652o-nu66-brss-yabwgp44h3b"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "4m5x3tk1-5zah-qvy1-fmow-fmef8564yg",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "0dyigrji-ay6p-yuik-xm8l-i1egd8o88ta",
      "ilnu44wz-vijk-zu5p-46d6-06b8eioq50qs",
      "e8s8ujl6-cvji-pwm2-5h18-suqr850eo2",
      "y5iami0j-652o-nu66-brss-yabwgp44h3b"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "st4ju10s-c5ga-3kl3-jbdh-xfzdslg7t1",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "cp7ht36f-o77n-tw38-kyza-tyyt2m2h99",
      "cwkf97gg-845u-hvw3-nw00-o3rdxfnjg8l"
    ],
    "cohortIds": [
      "tibafup8-ehpm-tllb-0wjt-j7qqm1q93qb",
      "4m5x3tk1-5zah-qvy1-fmow-fmef8564yg"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "n1sod4ij-pu0f-sw4a-0k8v-z6k80dgbcck",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "cp7ht36f-o77n-tw38-kyza-tyyt2m2h99",
      "cwkf97gg-845u-hvw3-nw00-o3rdxfnjg8l"
    ],
    "cohortIds": [
      "tibafup8-ehpm-tllb-0wjt-j7qqm1q93qb",
      "4m5x3tk1-5zah-qvy1-fmow-fmef8564yg"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "cpzxr0db-k3b8-kruh-yvzd-8sr8ofqpo",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "9qzos6ab-3bwm-w4yb-ueic-yckavlfklh",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "completedAt": "2025-07-17T03:01:01.247Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "5xz7rram-w9g6-6kke-ghtg-m3mkatdq98d",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "updatedAt": "2025-07-17T03:01:01.247Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "2pgn1ezo-vwxt-zpiw-nbj0-k42lyra70ej",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "passed": false,
    "score": 69,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "a7ws3j5d-bn7y-am77-hmqi-3mgwy5rw38l",
    "createdAt": "2025-07-17T03:01:01.247Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 29
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-17T03:01:01.247Z",
    "token": "token_1"
  }
];

