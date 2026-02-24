import { faker } from "@faker-js/faker";
import { writeFileSync } from "fs";

const SPORT_TYPES = [
  "Run",
  "Ride",
  "Swim",
  "Trail Run",
  "Hike",
  "Walk",
  "Workout",
  "WeightTraining",
];
const EXERCISE_TYPES = [
  { title: "Bench Press", type: "strength_chest" },
  { title: "Overhead Press", type: "strength_shoulders" },
  { title: "Pull-ups", type: "strength_back" },
  { title: "Barbell Row", type: "strength_back" },
  { title: "Squat", type: "strength_legs" },
  { title: "Romanian Deadlift", type: "strength_legs" },
  { title: "Incline Dumbbell Press", type: "strength_chest" },
  { title: "Lat Pulldown", type: "strength_back" },
  { title: "Bicep Curls", type: "strength_arms" },
  { title: "Tricep Extensions", type: "strength_arms" },
  { title: "Leg Press", type: "strength_legs" },
  { title: "Lunges", type: "strength_legs" },
  { title: "Deadlift", type: "strength_full" },
  { title: "Shoulder Press", type: "strength_shoulders" },
  { title: "Dumbbell Fly", type: "strength_chest" },
];

const NYC_LATLNG = [
  [40.7128, -74.006],
  [40.758, -73.9855],
  [40.785091, -73.968285],
  [40.78293, -73.965355],
  [40.8448, -73.8648],
  [40.6782, -73.9442],
  [40.7484, -73.9857],
  [40.7614, -73.9776],
  [40.7527, -73.9772],
  [40.7831, -73.9712],
];

function generateDateInRange(startDate: Date, endDate: Date): Date {
  const start = startDate.getTime();
  const end = endDate.getTime();
  return new Date(start + Math.random() * (end - start));
}

function generateStravaActivities(count: number) {
  const activities = [];
  const distanceMap: Record<string, number> = {};

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365);

  for (let i = 0; i < count; i++) {
    const activityDate = generateDateInRange(startDate, endDate);
    const dateKey = activityDate.toISOString().split("T")[0];
    const sportType = faker.helpers.arrayElement(SPORT_TYPES);

    let distance: number;
    let movingTime: number;

    switch (sportType) {
      case "Run":
      case "Trail Run":
        distance = faker.number.int({ min: 2000, max: 15000 });
        movingTime = Math.round(
          distance / (faker.number.float({ min: 2.5, max: 4.5 }) * 60),
        );
        break;
      case "Ride":
        distance = faker.number.int({ min: 5000, max: 80000 });
        movingTime = Math.round(
          distance / (faker.number.float({ min: 5, max: 12 }) * 60),
        );
        break;
      case "Swim":
        distance = faker.number.int({ min: 500, max: 3000 });
        movingTime = Math.round(distance / 30);
        break;
      default:
        distance = faker.number.int({ min: 1000, max: 10000 });
        movingTime = faker.number.int({ min: 600, max: 3600 });
    }

    const hasLocation =
      sportType !== "Swim" && faker.datatype.boolean({ probability: 0.7 });
    const startLatLng = hasLocation
      ? faker.helpers.arrayElement(NYC_LATLNG)
      : null;
    const endLatLng = hasLocation
      ? faker.helpers.arrayElement(NYC_LATLNG)
      : null;

    const activity = {
      id: faker.number.int({ min: 10000000000, max: 99999999999 }),
      name: faker.helpers.arrayElement([
        "Morning Run",
        "Afternoon Ride",
        "Evening Swim",
        "Trail Run",
        "Cycling Commute",
        "Easy Run",
        "Hill Repeats",
        "Recovery Run",
        "Long Ride",
        "Speed Workout",
        "Lunch Walk",
        "Evening Hike",
        "Weekend Long Run",
        "Easy Pace Run",
        "Fartlek Training",
      ]),
      type: sportType,
      start_date: activityDate.toISOString(),
      distance,
      moving_time: movingTime,
      sport_type: sportType,
      start_latlng: startLatLng,
      end_latlng: endLatLng,
    };

    activities.push(activity);

    if (!distanceMap[dateKey]) {
      distanceMap[dateKey] = 0;
    }
    distanceMap[dateKey] += distance;
  }

  activities.sort(
    (a, b) =>
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
  );

  return { activities, distance: distanceMap };
}

function generateHevyWorkouts(count: number) {
  const workouts = [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365);

  for (let i = 0; i < count; i++) {
    const workoutDate = generateDateInRange(startDate, endDate);
    const workoutDuration = faker.number.int({ min: 30, max: 90 });
    const startTime = new Date(workoutDate);
    const endTime = new Date(startTime.getTime() + workoutDuration * 60 * 1000);

    const exerciseCount = faker.number.int({ min: 2, max: 6 });
    const exercises = [];

    let setCounter = 1;

    for (let j = 0; j < exerciseCount; j++) {
      const exerciseTemplate = faker.helpers.arrayElement(EXERCISE_TYPES);
      const setCount = faker.number.int({ min: 2, max: 4 });
      const sets = [];

      for (let k = 0; k < setCount; k++) {
        sets.push({
          set_id: `s${String(setCounter).padStart(3, "0")}`,
          exercise_id: `ex${String(j + 1).padStart(3, "0")}`,
          workout_id: `w${String(i + 1).padStart(3, "0")}`,
          set_order: k + 1,
          weight_kg:
            exerciseTemplate.type.includes("chest") ||
            exerciseTemplate.type.includes("back")
              ? faker.number.int({ min: 30, max: 100 })
              : faker.number.int({ min: 20, max: 80 }),
          reps: faker.number.int({ min: 6, max: 15 }),
          distance_km: null,
          duration_seconds: null,
          rpe: faker.number.int({ min: 6, max: 10 }),
          notes: null,
          created_at: new Date(startTime.getTime() + k * 60000).toISOString(),
          updated_at: new Date(startTime.getTime() + k * 60000).toISOString(),
        });
        setCounter++;
      }

      exercises.push({
        exercise_id: `ex${String(j + 1).padStart(3, "0")}`,
        workout_id: `w${String(i + 1).padStart(3, "0")}`,
        exercise_order: j + 1,
        title: exerciseTemplate.title,
        exercise_type_id: exerciseTemplate.type,
        notes: null,
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
        sets,
      });
    }

    workouts.push({
      id: `w${String(i + 1).padStart(3, "0")}`,
      title: faker.helpers.arrayElement([
        "Push Day",
        "Pull Day",
        "Leg Day",
        "Upper Body",
        "Lower Body",
        "Full Body",
        "Chest Day",
        "Back Day",
        "Shoulders & Arms",
        "Strength Training",
      ]),
      description: faker.helpers.arrayElement([
        "Chest, shoulders, triceps",
        "Back and biceps",
        "Quads, hamstrings, calves",
        "Mixed upper body workout",
        "Full body workout",
        "Strength focused session",
      ]),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      created_at: endTime.toISOString(),
      updated_at: endTime.toISOString(),
      exercises,
    });
  }

  workouts.sort(
    (a, b) =>
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );

  return { workouts };
}

function generateHealthData(days: number) {
  const steps: Record<
    string,
    { steps: number; distance: number; calories: number }
  > = {};
  const heartRate: Record<
    string,
    {
      resting: number;
      avg: number;
      max: number;
      zones: { rest: number; fat_burn: number; cardio: number; peak: number };
    }
  > = {};
  const moveMinutes: Record<
    string,
    { total: number; active: number; heart: number }
  > = {};
  const sleep: Record<
    string,
    {
      duration: number;
      deep: number;
      light: number;
      rem: number;
      awake: number;
    }
  > = {};

  const endDate = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];

    steps[dateKey] = {
      steps: faker.number.int({ min: 3000, max: 20000 }),
      distance: faker.number.float({ min: 2, max: 15, fractionDigits: 1 }),
      calories: faker.number.int({ min: 150, max: 600 }),
    };

    heartRate[dateKey] = {
      resting: faker.number.int({ min: 55, max: 70 }),
      avg: faker.number.int({ min: 70, max: 95 }),
      max: faker.number.int({ min: 130, max: 180 }),
      zones: {
        rest: faker.number.int({ min: 500, max: 800 }),
        fat_burn: faker.number.int({ min: 80, max: 200 }),
        cardio: faker.number.int({ min: 20, max: 100 }),
        peak: faker.number.int({ min: 0, max: 30 }),
      },
    };

    moveMinutes[dateKey] = {
      total: faker.number.int({ min: 20, max: 120 }),
      active: faker.number.int({ min: 10, max: 80 }),
      heart: faker.number.int({ min: 10, max: 40 }),
    };

    sleep[dateKey] = {
      duration: faker.number.int({ min: 300, max: 540 }),
      deep: faker.number.int({ min: 60, max: 150 }),
      light: faker.number.int({ min: 180, max: 300 }),
      rem: faker.number.int({ min: 45, max: 120 }),
      awake: faker.number.int({ min: 5, max: 30 }),
    };
  }

  return { steps, heartRate, moveMinutes, sleep };
}

console.log("Generating massive dummy data...");

const stravaData = generateStravaActivities(500);
writeFileSync(
  "./public/strava-activities-dummy.json",
  JSON.stringify(stravaData, null, 2),
);
console.log(
  `✓ Generated strava-activities-dummy.json with ${stravaData.activities.length} activities`,
);

const hevyData = generateHevyWorkouts(50);
writeFileSync(
  "./public/hevy-workouts-dummy.json",
  JSON.stringify(hevyData, null, 2),
);
console.log(
  `✓ Generated hevy-workouts-dummy.json with ${hevyData.workouts.length} workouts`,
);

const healthData = generateHealthData(365);
writeFileSync(
  "./public/health-data-dummy.json",
  JSON.stringify(healthData, null, 2),
);
console.log(`✓ Generated health-data-dummy.json with 365 days of data`);

console.log("\nDone! All dummy data files have been generated.");
