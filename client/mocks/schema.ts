// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 69,
    "userId": 52,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 79,
    "userId": 15,
    "expires": "2025-07-23T03:45:19.380Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "gfgkvl84-mk76-nlik-sqm7-954nxiz5hyc",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 65,
    "name": "Admin User",
    "emailVerified": "2025-07-23T03:45:19.380Z",
    "image": "image_1"
  },
  {
    "id": 39,
    "name": "Instructional User"
  },
  {
    "id": 68,
    "name": "Instructor User",
    "email": "instructor@example.com"
  },
  {
    "id": 23,
    "name": "TA User",
    "emailVerified": "2025-07-23T03:45:19.380Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "hb2b9eij-o4ca-phc3-11bf-k448iep1nx",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "userId": 65,
    "lastLogin": "2025-07-23T03:45:19.380Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-23T03:45:19.380Z"
  },
  {
    "id": "eliyhp0d-x9xd-vy9b-qplm-wzl3gvwrxyb",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "userId": 39,
    "lastLogin": "2025-07-23T03:45:19.380Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-23T03:45:19.380Z"
  },
  {
    "id": "clsi5k4f-1ckg-1isx-z3u4-0rk3oax48n6n",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "userId": 68,
    "lastLogin": "2025-07-23T03:45:19.380Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-23T03:45:19.380Z"
  },
  {
    "id": "ovbx5dc1-2bts-8xlo-1w1w-s54e3scpnn",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "userId": 23,
    "lastLogin": "2025-07-23T03:45:19.380Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-23T03:45:19.380Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "w83x0vee-c8if-jmjc-uedk-nqno9urlo",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "oetfiybs-sf40-tl95-t7hg-y2sv1dbz5le",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "agc5zwmd-ftfq-9auw-a02s-nmb01jw8b1g",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 64,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "icu3vab1-41xg-m56q-n5e9-ems8a22584",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 41,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "bf1cwdp0-xuj7-6tbx-8lqj-ujt4dypcwuf",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 43,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 65,
    "level": "level_1",
    "createdAt": "2025-07-23T03:45:19.380Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "wz2owncn-036v-bxo6-1vm3-wh0dq4ae20g",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 29,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 48,
    "createdAt": "2025-07-23T03:45:19.380Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "wfvrdnv9-mb75-qo1c-1bu6-42d7a2nmev6",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "hdmqth2z-dcnq-lmpr-01be-81x7ba28os3",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "completedAt": "2025-07-23T03:45:19.380Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "hla88ri5-cdi0-rn71-oo7l-ypjg0eeatc",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "completedAt": "2025-07-23T03:45:19.380Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "j6safmo7-28lh-bwti-ctcf-ni9ftfxba7c",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "3uot7ss4-7wth-mxx2-pqln-gaxft7wmlri",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
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

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "xenompzb-eku3-f3qo-ckia-hqpd2ldzqqj",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.32,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "modelId": "modelId_1"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "tgw8b9um-ttrh-s8zy-3pp1-ru0nwamhex",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.61,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "ptwqxunh-w2af-ld84-gsfj-53826do8wa4",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "crowdedness": 18,
    "intensity": 59,
    "classId": "classId_1",
    "locationId": "locationId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "active": true
  },
  {
    "id": "qd4co807-ja16-l1rs-ztwo-zpmc58plijs",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "intensity": 29,
    "classId": "classId_2",
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2",
    "active": false
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "7qmesm7d-txnk-s846-h5x3-2ccw19l6e3m",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1",
    "description": "Description for scenario_classes 1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "b9x4l9po-quw7-ro5o-g06q-gna1qhuz8cu",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "t555ioms-tlwg-zogu-dmxh-k1gosrtbyog",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "dtttedcl-9xov-f51u-tt7c-3p4nbpip5hq",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "p8d12oge-ityw-utke-7g22-b0tp6d0alhc",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "ptwqxunh-w2af-ld84-gsfj-53826do8wa4",
      "qd4co807-ja16-l1rs-ztwo-zpmc58plijs"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "yywpu20s-ex34-gnfj-p17d-bvns8i9pyli",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "ptwqxunh-w2af-ld84-gsfj-53826do8wa4",
      "qd4co807-ja16-l1rs-ztwo-zpmc58plijs"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "zpwecyu9-9cyv-x5ry-7yq4-n6ifq1t2u0n",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "tcmx40t5-y3k3-7b6k-veof-76z5xf5d89l",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
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
    "id": "2qhetkl6-bgcg-xcw0-715t-6n9rqk08doq",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "sot4jn8y-wv8b-9eb3-90kt-0erz77lq4y7",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "passed": false,
    "score": 60,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "jqjpa453-ytig-f1b0-qanj-utqcj9sflm",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 85,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "823yxt8s-1k3j-lcx7-q555-2e2ege6ksxk",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "hb2b9eij-o4ca-phc3-11bf-k448iep1nx",
      "eliyhp0d-x9xd-vy9b-qplm-wzl3gvwrxyb",
      "clsi5k4f-1ckg-1isx-z3u4-0rk3oax48n6n",
      "ovbx5dc1-2bts-8xlo-1w1w-s54e3scpnn"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "p8d12oge-ityw-utke-7g22-b0tp6d0alhc",
      "yywpu20s-ex34-gnfj-p17d-bvns8i9pyli"
    ]
  },
  {
    "id": "hkk13fna-u3dp-zd4z-7nwy-k428muhsjp9",
    "createdAt": "2025-07-23T03:45:19.380Z",
    "updatedAt": "2025-07-23T03:45:19.380Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "hb2b9eij-o4ca-phc3-11bf-k448iep1nx",
      "eliyhp0d-x9xd-vy9b-qplm-wzl3gvwrxyb",
      "clsi5k4f-1ckg-1isx-z3u4-0rk3oax48n6n",
      "ovbx5dc1-2bts-8xlo-1w1w-s54e3scpnn"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "p8d12oge-ityw-utke-7g22-b0tp6d0alhc",
      "yywpu20s-ex34-gnfj-p17d-bvns8i9pyli"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-23T03:45:19.380Z",
    "token": "token_1"
  }
];

