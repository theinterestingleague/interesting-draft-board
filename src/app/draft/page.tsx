"use client";

import Link from "next/link";
import { Anton, Lobster } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DraftUser } from "@/lib/auth";
import { formatPickLabel, getDraftBoard, getTeamOnClock } from "@/lib/draft";
import { league, teams } from "@/lib/league";
import {
  DraftPick,
  DraftedPlayer,
  getCurrentPickNumber,
  getPickByNumber,
} from "@/lib/picks";
import { validatePickAgainstRosterRules } from "@/lib/roster-rules";
import { getPositionClass } from "@/lib/styles";

type PlayerSearchResult = DraftedPlayer & {
  headshot?: string | null;
};

type DraftedPlayerWithHeadshot = DraftedPlayer & {
  headshot?: string | null;
};

type DraftPickBackup = {
  id: string;
  createdAt: string;
  reason: string;
  pickCount: number;
  picks: DraftPick[];
};

type DraftPicksApiResponse = {
  picks?: DraftPick[];
  message?: string;
};

type DraftOrderApiResponse = {
  teamIds?: string[];
  isEditable?: boolean;
  message?: string;
};

type DraftStateApiResponse = {
  isLocked?: boolean;
  message?: string;
};

const DRAFT_BACKUP_HISTORY_KEY = "draftPicksBackupHistory";
const DRAFT_LATEST_BACKUP_KEY = "draftPicksLatestBackup";
const MAX_DRAFT_BACKUPS = 50;
const COMMISSIONER_UNLOCK_PASSWORD = "sproles43";

function getDraftBackupHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawBackupHistory = window.localStorage.getItem(
      DRAFT_BACKUP_HISTORY_KEY,
    );

    if (!rawBackupHistory) {
      return [];
    }

    const parsedBackupHistory = JSON.parse(rawBackupHistory);

    if (!Array.isArray(parsedBackupHistory)) {
      return [];
    }

    return parsedBackupHistory.filter(
      (backup): backup is DraftPickBackup =>
        backup &&
        typeof backup.id === "string" &&
        typeof backup.createdAt === "string" &&
        Array.isArray(backup.picks),
    );
  } catch {
    return [];
  }
}

function getLatestDraftBackup() {
  const backupHistory = getDraftBackupHistory();

  return backupHistory[0] ?? null;
}

function saveDraftBackupSnapshot(picksToBackUp: DraftPick[], reason: string) {
  if (typeof window === "undefined" || picksToBackUp.length === 0) {
    return null;
  }

  const backup: DraftPickBackup = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    reason,
    pickCount: picksToBackUp.length,
    picks: picksToBackUp,
  };

  const updatedBackupHistory = [backup, ...getDraftBackupHistory()].slice(
    0,
    MAX_DRAFT_BACKUPS,
  );

  window.localStorage.setItem(
    DRAFT_BACKUP_HISTORY_KEY,
    JSON.stringify(updatedBackupHistory),
  );
  window.localStorage.setItem(DRAFT_LATEST_BACKUP_KEY, JSON.stringify(backup));

  return backup;
}

const lobster = Lobster({
  subsets: ["latin"],
  weight: "400",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
});

const positionOptions = ["QB", "RB", "WR", "TE", "K"];

const nflTeamOptions = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
  "FA",
];

function getEspnTeamLogoUrl(nflTeam: string) {
  const espnTeamMap: Record<string, string> = {
    ARI: "ari",
    ATL: "atl",
    BAL: "bal",
    BUF: "buf",
    CAR: "car",
    CHI: "chi",
    CIN: "cin",
    CLE: "cle",
    DAL: "dal",
    DEN: "den",
    DET: "det",
    GB: "gb",
    HOU: "hou",
    IND: "ind",
    JAX: "jax",
    KC: "kc",
    LAC: "lac",
    LAR: "lar",
    LV: "lv",
    MIA: "mia",
    MIN: "min",
    NE: "ne",
    NO: "no",
    NYG: "nyg",
    NYJ: "nyj",
    PHI: "phi",
    PIT: "pit",
    SEA: "sea",
    SF: "sf",
    TB: "tb",
    TEN: "ten",
    WAS: "wsh",
  };

  const espnTeamId = espnTeamMap[nflTeam];

  if (!espnTeamId) {
    return null;
  }

  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnTeamId}.png`;
}

function getOrdinalNumber(number: number) {
  const remainder100 = number % 100;

  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${number}th`;
  }

  switch (number % 10) {
    case 1:
      return `${number}st`;
    case 2:
      return `${number}nd`;
    case 3:
      return `${number}rd`;
    default:
      return `${number}th`;
  }
}

function splitPlayerName(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  return {
    firstName,
    lastName,
  };
}

function isNaturalDraftVoice(voice: SpeechSynthesisVoice) {
  const voiceName = voice.name.toLowerCase();
  const voiceLang = voice.lang.toLowerCase();

  if (!voiceLang.startsWith("en")) {
    return false;
  }

  const realisticVoiceNames = [
    "google us english",
    "google uk english male",
    "google uk english female",
    "microsoft guy",
    "microsoft david",
    "microsoft ryan",
    "microsoft mark",
    "microsoft george",
    "microsoft aria",
    "microsoft jenny",
    "samantha",
    "ava",
    "allison",
    "susan",
    "tom",
    "daniel",
    "karen",
    "moira",
    "tessa",
    "fiona",
    "serena",
    "arthur",
    "martha",
    "jamie",
    "oliver",
    "aaron",
    "nicky",
    "reed",
    "sandy",
    "shelley",
  ];

  const obviouslyBadVoiceNames = [
    "alex",
    "bells",
    "boing",
    "bubbles",
    "cellos",
    "deranged",
    "fred",
    "good news",
    "hysterical",
    "junior",
    "kathy",
    "organ",
    "princess",
    "ralph",
    "trinoids",
    "vicki",
    "victoria",
    "whisper",
    "zarvox",
  ];

  if (
    obviouslyBadVoiceNames.some((badVoiceName) =>
      voiceName.includes(badVoiceName),
    )
  ) {
    return false;
  }

  return realisticVoiceNames.some((realisticVoiceName) =>
    voiceName.includes(realisticVoiceName),
  );
}

function isSafariBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const vendor = navigator.vendor.toLowerCase();

  return (
    vendor.includes("apple") &&
    userAgent.includes("safari") &&
    !userAgent.includes("chrome") &&
    !userAgent.includes("crios") &&
    !userAgent.includes("fxios")
  );
}

function findPreferredVoice(
  voices: SpeechSynthesisVoice[],
  preferredNames: string[],
) {
  for (const preferredName of preferredNames) {
    const exactMatch = voices.find(
      (voice) => voice.name.toLowerCase() === preferredName.toLowerCase(),
    );

    if (exactMatch) {
      return exactMatch.voiceURI;
    }

    const includesMatch = voices.find((voice) =>
      voice.name.toLowerCase().includes(preferredName.toLowerCase()),
    );

    if (includesMatch) {
      return includesMatch.voiceURI;
    }
  }

  return "";
}

function getPreferredDefaultVoice(voices: SpeechSynthesisVoice[]) {
  const safariPreferredOrder = [
    "Samantha",
    "Ava",
    "Allison",
    "Susan",
    "Tom",
    "Jamie",
    "Nicky",
  ];

  const chromePreferredOrder = [
    "Google US English",
    "Microsoft Jenny",
    "Microsoft Aria",
    "Microsoft Guy",
    "Samantha",
    "Ava",
    "Allison",
    "Tom",
    "Google UK English Female",
    "Google UK English Male",
    "Microsoft David",
    "Microsoft Ryan",
    "Microsoft Mark",
    "Microsoft George",
  ];

  const preferredOrder = isSafariBrowser()
    ? safariPreferredOrder
    : chromePreferredOrder;

  return (
    findPreferredVoice(voices, preferredOrder) ||
    findPreferredVoice(voices, [
      ...safariPreferredOrder,
      ...chromePreferredOrder,
    ]) ||
    voices[0]?.voiceURI ||
    ""
  );
}

export default function DraftPage() {
  const router = useRouter();

  const [user, setUser] = useState<DraftUser | null>(null);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [nflTeamFilter, setNflTeamFilter] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerSearchResult | null>(null);
  const [error, setError] = useState("");
  const [announcePicks, setAnnouncePicks] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [isLightMode, setIsLightMode] = useState(false);
  const [latestBackup, setLatestBackup] = useState<DraftPickBackup | null>(
    null,
  );
  const [isBoardLocked, setIsBoardLocked] = useState(false);
  const [isSyncingPicks, setIsSyncingPicks] = useState(false);
  const [draftOrderTeamIds, setDraftOrderTeamIds] = useState<string[]>(() =>
    teams.map((team) => team.id),
  );
  const [editableDraftOrderTeamIds, setEditableDraftOrderTeamIds] = useState<
    string[]
  >(() => teams.map((team) => team.id));
  const [isEditingDraftOrder, setIsEditingDraftOrder] = useState(false);
  const isEditingDraftOrderRef = useRef(false);
  const draftOrderTeamIdsRef = useRef<string[]>(teams.map((team) => team.id));
  const userRef = useRef<DraftUser | null>(null);
  const [isSavingDraftOrder, setIsSavingDraftOrder] = useState(false);
  const [draggedDraftOrderTeamId, setDraggedDraftOrderTeamId] = useState<
    string | null
  >(null);
  const [recentPickGraphic, setRecentPickGraphic] = useState<DraftPick | null>(
    null,
  );
  const hasLoadedPicksRef = useRef(false);
  const previousPickCountRef = useRef(0);
  const pickGraphicTimeoutRef = useRef<number | null>(null);
  const turnAlertAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitializedTurnAlertRef = useRef(false);
  const hasPrimedTurnAlertAudioRef = useRef(false);
  const hasPrimedSpeechRef = useRef(false);

  const [editingPickNumber, setEditingPickNumber] = useState<number | null>(
    null,
  );
  const [editingNote, setEditingNote] = useState("");
  const [replacementQuery, setReplacementQuery] = useState("");
  const [replacementResults, setReplacementResults] = useState<
    PlayerSearchResult[]
  >([]);
  const [isSearchingReplacement, setIsSearchingReplacement] = useState(false);
  const [replacementPlayer, setReplacementPlayer] =
    useState<PlayerSearchResult | null>(null);

  const currentPick = getCurrentPickNumber(picks);
  const currentTeam = getTeamOnClock(currentPick, draftOrderTeamIds);
  const draftBoard = getDraftBoard(league.numberOfRounds, draftOrderTeamIds);

  const editingPick =
    editingPickNumber !== null
      ? getPickByNumber(picks, editingPickNumber)
      : undefined;

  const draftedPlayerIds = useMemo(
    () => picks.map((pick) => pick.player.id),
    [picks],
  );

  const draftedPlayerIdsForReplacement = useMemo(() => {
    if (!editingPick) {
      return draftedPlayerIds;
    }

    return draftedPlayerIds.filter((id) => id !== editingPick.player.id);
  }, [draftedPlayerIds, editingPick]);

  const draftedPlayerIdsKey = draftedPlayerIds.join(",");
  const draftedPlayerIdsForReplacementKey =
    draftedPlayerIdsForReplacement.join(",");

  const canMakeCurrentPick =
    user &&
    currentTeam &&
    (user.isCommissioner || user.teamId === currentTeam.id);

  const isUsersActualTurn =
    user && currentTeam && user.teamId === currentTeam.id;

  const recentPickSplitName = recentPickGraphic
    ? splitPlayerName(recentPickGraphic.player.name)
    : null;

  const recentPickPlayer = recentPickGraphic?.player as
    | DraftedPlayerWithHeadshot
    | undefined;

  const canEditDraftOrder = Boolean(user?.isCommissioner && picks.length === 0);

  function getTeamById(teamId: string) {
    return teams.find((team) => team.id === teamId);
  }

  function moveDraftOrderTeam(teamId: string, direction: -1 | 1) {
    setEditableDraftOrderTeamIds((currentTeamIds) => {
      const currentIndex = currentTeamIds.indexOf(teamId);
      const nextIndex = currentIndex + direction;

      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= currentTeamIds.length) {
        return currentTeamIds;
      }

      const nextTeamIds = [...currentTeamIds];
      const [removedTeamId] = nextTeamIds.splice(currentIndex, 1);
      nextTeamIds.splice(nextIndex, 0, removedTeamId);

      return nextTeamIds;
    });
  }

  function moveDraggedTeamBefore(targetTeamId: string) {
    if (!draggedDraftOrderTeamId || draggedDraftOrderTeamId === targetTeamId) {
      return;
    }

    setEditableDraftOrderTeamIds((currentTeamIds) => {
      const nextTeamIds = currentTeamIds.filter(
        (teamId) => teamId !== draggedDraftOrderTeamId,
      );
      const targetIndex = nextTeamIds.indexOf(targetTeamId);

      if (targetIndex === -1) {
        return currentTeamIds;
      }

      nextTeamIds.splice(targetIndex, 0, draggedDraftOrderTeamId);

      return nextTeamIds;
    });
  }

  useEffect(() => {
    draftOrderTeamIdsRef.current = draftOrderTeamIds;
  }, [draftOrderTeamIds]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (isCheckingLogin) {
      return;
    }

    const previousPickCount = previousPickCountRef.current;

    if (!hasLoadedPicksRef.current) {
      hasLoadedPicksRef.current = true;
      previousPickCountRef.current = picks.length;
      return;
    }

    if (picks.length > previousPickCount) {
      const newestPick = [...picks].sort(
        (a, b) => b.pickNumber - a.pickNumber,
      )[0];

      if (newestPick) {
        setRecentPickGraphic(newestPick);

        if (announcePicks) {
          window.setTimeout(() => {
            announcePick(newestPick);
          }, 250);
        }

        if (pickGraphicTimeoutRef.current) {
          window.clearTimeout(pickGraphicTimeoutRef.current);
        }

        pickGraphicTimeoutRef.current = window.setTimeout(() => {
          setRecentPickGraphic(null);
        }, 5000);
      }
    }

    previousPickCountRef.current = picks.length;
  }, [announcePicks, isCheckingLogin, picks, selectedVoiceURI]);

  useEffect(() => {
    return () => {
      if (pickGraphicTimeoutRef.current) {
        window.clearTimeout(pickGraphicTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const savedUser = window.localStorage.getItem("draftUser");
    const savedAnnouncePicks =
      window.localStorage.getItem("announcePicks") === "true";
    const savedTheme = window.localStorage.getItem("draftTheme") ?? "dark";

    if (!savedUser) {
      router.push("/");
      return;
    }

    setUser(JSON.parse(savedUser));
    loadDraftOrder();
    loadDraftState();
    loadSharedPicks();
    setAnnouncePicks(savedAnnouncePicks);
    setIsLightMode(savedTheme === "light");
    setLatestBackup(getLatestDraftBackup());
    setIsCheckingLogin(false);
  }, [router]);

  useEffect(() => {
    if (isCheckingLogin || !user) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadSharedPicks({ quiet: true });
      loadDraftState({ quiet: true });

      if (picks.length === 0 && !isEditingDraftOrderRef.current) {
        loadDraftOrder({ quiet: true });
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isCheckingLogin, user, picks.length]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    function loadVoices() {
      const allEnglishVoices = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith("en"));

      const naturalVoices = allEnglishVoices.filter(isNaturalDraftVoice);
      const voices = naturalVoices;

      setAvailableVoices(voices);

      const defaultVoiceURI = getPreferredDefaultVoice(voices);

      if (defaultVoiceURI) {
        window.localStorage.setItem("announceVoiceURI", defaultVoiceURI);
      }

      setSelectedVoiceURI(defaultVoiceURI);
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const canBrowseFilteredPlayers = Boolean(positionFilter && nflTeamFilter);

    if (
      (trimmedQuery.length < 2 && !canBrowseFilteredPlayers) ||
      selectedPlayer
    ) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearching(true);

        const params = new URLSearchParams({
          q: trimmedQuery,
          draftedIds: draftedPlayerIdsKey,
        });

        if (positionFilter) {
          params.set("position", positionFilter);
        }

        if (nflTeamFilter) {
          params.set("nflTeam", nflTeamFilter);
        }

        const response = await fetch(`/api/players/search?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Player search failed.");
        }

        const data = await response.json();
        setSearchResults(data.players ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    query,
    selectedPlayer,
    draftedPlayerIdsKey,
    positionFilter,
    nflTeamFilter,
  ]);

  useEffect(() => {
    const trimmedQuery = replacementQuery.trim();
    const canBrowseFilteredPlayers = Boolean(positionFilter && nflTeamFilter);

    if (
      (trimmedQuery.length < 2 && !canBrowseFilteredPlayers) ||
      replacementPlayer
    ) {
      setReplacementResults([]);
      setIsSearchingReplacement(false);
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearchingReplacement(true);

        const params = new URLSearchParams({
          q: trimmedQuery,
          draftedIds: draftedPlayerIdsForReplacementKey,
        });

        if (positionFilter) {
          params.set("position", positionFilter);
        }

        if (nflTeamFilter) {
          params.set("nflTeam", nflTeamFilter);
        }

        const response = await fetch(`/api/players/search?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Replacement player search failed.");
        }

        const data = await response.json();
        setReplacementResults(data.players ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setReplacementResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingReplacement(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    replacementQuery,
    replacementPlayer,
    draftedPlayerIdsForReplacementKey,
    positionFilter,
    nflTeamFilter,
  ]);

  async function readDraftPicksResponse(response: Response) {
    const data = (await response
      .json()
      .catch(() => ({}))) as DraftPicksApiResponse;

    if (!response.ok) {
      throw new Error(data.message ?? "Draft update failed.");
    }

    return data;
  }

  async function readDraftOrderResponse(response: Response) {
    const data = (await response
      .json()
      .catch(() => ({}))) as DraftOrderApiResponse;

    if (!response.ok) {
      throw new Error(data.message ?? "Draft order update failed.");
    }

    return data;
  }

  async function readDraftStateResponse(response: Response) {
    const data = (await response
      .json()
      .catch(() => ({}))) as DraftStateApiResponse;

    if (!response.ok) {
      throw new Error(data.message ?? "Draft state update failed.");
    }

    return data;
  }

  async function loadDraftState({ quiet = false } = {}) {
    try {
      const response = await fetch("/api/draft-state", {
        cache: "no-store",
      });
      const data = await readDraftStateResponse(response);

      setIsBoardLocked(Boolean(data.isLocked));
    } catch (error) {
      console.error(error);

      if (!quiet) {
        setError(
          error instanceof Error
            ? error.message
            : "Could not load shared draft state.",
        );
      }
    }
  }

  async function loadDraftOrder({ quiet = false } = {}) {
    try {
      const response = await fetch("/api/draft-order", {
        cache: "no-store",
      });
      const data = await readDraftOrderResponse(response);
      const teamIds = data.teamIds ?? teams.map((team) => team.id);

      setDraftOrderTeamIds(teamIds);

      if (!isEditingDraftOrderRef.current) {
        setEditableDraftOrderTeamIds(teamIds);
      }
    } catch (error) {
      console.error(error);

      if (!quiet) {
        setError(
          error instanceof Error
            ? error.message
            : "Could not load shared draft order.",
        );
      }
    }
  }

  async function loadSharedPicks({ quiet = false } = {}) {
    if (!quiet) {
      setIsSyncingPicks(true);
    }

    try {
      const response = await fetch("/api/picks", {
        cache: "no-store",
      });
      const data = await readDraftPicksResponse(response);
      const loadedPicks = data.picks ?? [];

      setPicks((previousPicks) => {
        const previousCurrentPick = getCurrentPickNumber(previousPicks);
        const nextCurrentPick = getCurrentPickNumber(loadedPicks);
        const nextCurrentTeam = getTeamOnClock(
          nextCurrentPick,
          draftOrderTeamIdsRef.current,
        );
        const boardAdvanced = nextCurrentPick !== previousCurrentPick;
        const pickWasAdded = loadedPicks.length > previousPicks.length;
        const shouldPlayTurnAlert =
          hasInitializedTurnAlertRef.current &&
          pickWasAdded &&
          boardAdvanced &&
          Boolean(userRef.current) &&
          nextCurrentTeam?.id === userRef.current?.teamId;

        if (!hasInitializedTurnAlertRef.current) {
          hasInitializedTurnAlertRef.current = true;
        }

        if (shouldPlayTurnAlert) {
          window.setTimeout(() => {
            playTurnAlert();
          }, 150);
        }

        return loadedPicks;
      });
    } catch (error) {
      console.error(error);

      if (!quiet) {
        setError(
          error instanceof Error
            ? error.message
            : "Could not load shared draft picks.",
        );
      }
    } finally {
      if (!quiet) {
        setIsSyncingPicks(false);
      }
    }
  }

  function saveBackupBeforeSharedChange(reason: string) {
    const backup = saveDraftBackupSnapshot(picks, reason);

    if (backup) {
      setLatestBackup(backup);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("draftUser");
    router.push("/");
  }

  function primeTurnAlertAudio() {
    if (hasPrimedTurnAlertAudioRef.current) {
      return;
    }

    const audio = turnAlertAudioRef.current ?? new Audio("/draft-alert.mp3");

    turnAlertAudioRef.current = audio;
    hasPrimedTurnAlertAudioRef.current = true;
    audio.volume = 0;

    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0.8;
      })
      .catch(() => {
        audio.volume = 0.8;
      });
  }

  function primeSpeechSynthesis() {
    if (hasPrimedSpeechRef.current || !("speechSynthesis" in window)) {
      return;
    }

    hasPrimedSpeechRef.current = true;

    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    utterance.lang = "en-US";

    window.speechSynthesis.speak(utterance);
  }

  function handlePrimeBrowserAudio() {
    primeTurnAlertAudio();
    primeSpeechSynthesis();
  }

  function playTurnAlert() {
    const audio = turnAlertAudioRef.current ?? new Audio("/draft-alert.mp3");

    turnAlertAudioRef.current = audio;
    audio.volume = 0.8;
    audio.currentTime = 0;

    audio.play().catch((error) => {
      console.warn("Draft alert audio could not play yet.", error);
    });
  }

  function getBestAnnouncerVoice() {
    if (!("speechSynthesis" in window)) {
      return null;
    }

    const allEnglishVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("en"));

    const naturalVoices = allEnglishVoices.filter(isNaturalDraftVoice);
    const voices = naturalVoices.length > 0 ? naturalVoices : allEnglishVoices;

    const preferredNames = isSafariBrowser()
      ? ["Samantha", "Ava", "Allison", "Tom"]
      : [
          "Google US English",
          "Microsoft Jenny",
          "Microsoft Aria",
          "Microsoft Guy",
          "Samantha",
          "Ava",
          "Allison",
        ];

    for (const preferredName of preferredNames) {
      const exactMatch = voices.find(
        (voice) => voice.name.toLowerCase() === preferredName.toLowerCase(),
      );

      if (exactMatch) {
        return exactMatch;
      }

      const includesMatch = voices.find((voice) =>
        voice.name.toLowerCase().includes(preferredName.toLowerCase()),
      );

      if (includesMatch) {
        return includesMatch;
      }
    }

    return voices[0] ?? null;
  }

  function speakMessage(message: string) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const voice = getBestAnnouncerVoice();
    const utterance = new SpeechSynthesisUtterance(message);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }

  function handleToggleAnnouncePicks() {
    const updatedValue = !announcePicks;

    setAnnouncePicks(updatedValue);
    window.localStorage.setItem("announcePicks", String(updatedValue));

    if (updatedValue) {
      speakMessage("Pick announcements on.");
    }
  }

  function handleToggleTheme() {
    const updatedValue = !isLightMode;

    setIsLightMode(updatedValue);
    window.localStorage.setItem("draftTheme", updatedValue ? "light" : "dark");
  }

  async function handleToggleBoardLock() {
    if (!user?.isCommissioner) {
      return;
    }

    const nextLockedValue = !isBoardLocked;
    let unlockPassword: string | undefined;

    if (nextLockedValue) {
      const confirmed = window.confirm(
        "Lock the draft board for everyone? This will prevent picks, edits, undo, reset, and restore until it is unlocked.",
      );

      if (!confirmed) {
        return;
      }
    } else {
      const password = window.prompt("Enter commissioner unlock password:");

      if (password !== COMMISSIONER_UNLOCK_PASSWORD) {
        setError("Incorrect unlock password.");
        return;
      }

      unlockPassword = password;
    }

    try {
      setIsSyncingPicks(true);

      const response = await fetch("/api/draft-state", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isLocked: nextLockedValue,
          unlockPassword,
        }),
      });
      const data = await readDraftStateResponse(response);

      setIsBoardLocked(Boolean(data.isLocked));
      setError("");
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Could not update the shared draft lock.",
      );
      await loadDraftState({ quiet: true });
    } finally {
      setIsSyncingPicks(false);
    }
  }

  function announcePick(pick: DraftPick) {
    const draftingTeam = getTeamOnClock(
      pick.pickNumber,
      draftOrderTeamIdsRef.current,
    );
    const teamName = draftingTeam?.displayName ?? pick.teamId;
    const ordinalPick = getOrdinalNumber(pick.pickNumber);
    const message = `With the ${ordinalPick} pick, ${teamName} selects ${pick.player.name}.`;

    speakMessage(message);
  }

  function handleSelectPlayer(player: PlayerSearchResult) {
    setSelectedPlayer(player);
    setQuery(player.name);
    setSearchResults([]);
    setError("");
  }

  async function updateSharedPicksFromResponse(response: Response) {
    const data = await readDraftPicksResponse(response);
    setPicks(data.picks ?? []);
    return data.picks ?? [];
  }

  function handleOpenDraftOrderEditor() {
    if (!user?.isCommissioner) {
      return;
    }

    if (picks.length > 0) {
      setError("Draft order can only be changed before the first pick.");
      return;
    }

    setEditableDraftOrderTeamIds(draftOrderTeamIds);
    isEditingDraftOrderRef.current = true;
    setIsEditingDraftOrder(true);
    setError("");
  }

  function handleCloseDraftOrderEditor() {
    setEditableDraftOrderTeamIds(draftOrderTeamIds);
    setDraggedDraftOrderTeamId(null);
    isEditingDraftOrderRef.current = false;
    setIsEditingDraftOrder(false);
  }

  async function handleSaveDraftOrder() {
    if (!user?.isCommissioner) {
      return;
    }

    if (picks.length > 0) {
      setError("Draft order can only be changed before the first pick.");
      return;
    }

    try {
      setIsSavingDraftOrder(true);
      const response = await fetch("/api/draft-order", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamIds: editableDraftOrderTeamIds,
        }),
      });
      const data = await readDraftOrderResponse(response);
      const teamIds = data.teamIds ?? editableDraftOrderTeamIds;

      setDraftOrderTeamIds(teamIds);
      setEditableDraftOrderTeamIds(teamIds);
      isEditingDraftOrderRef.current = false;
      setIsEditingDraftOrder(false);
      setDraggedDraftOrderTeamId(null);
      setError("");
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Could not save the draft order.",
      );
      await loadDraftOrder({ quiet: true });
    } finally {
      setIsSavingDraftOrder(false);
    }
  }

  async function handleRestoreLatestBackup() {
    if (!user?.isCommissioner) {
      return;
    }

    if (isBoardLocked) {
      setError(
        "The draft board is locked. Unlock it before restoring a backup.",
      );
      return;
    }

    const backup = getLatestDraftBackup();

    if (!backup) {
      setError("No draft backup found yet.");
      return;
    }

    const confirmed = window.confirm(
      `Restore the latest backup with ${backup.pickCount} picks? This will replace the shared draft board for everyone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsSyncingPicks(true);

      await updateSharedPicksFromResponse(
        await fetch("/api/picks", {
          method: "DELETE",
        }),
      );

      let restoredPicks: DraftPick[] = [];
      const picksToRestore = [...backup.picks].sort(
        (a, b) => a.pickNumber - b.pickNumber,
      );

      for (const pick of picksToRestore) {
        restoredPicks = await updateSharedPicksFromResponse(
          await fetch("/api/picks", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              playerId: pick.player.id,
              madeByTeamId: pick.madeByTeamId,
            }),
          }),
        );

        if (pick.note) {
          restoredPicks = await updateSharedPicksFromResponse(
            await fetch(`/api/picks/${pick.pickNumber}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                note: pick.note,
              }),
            }),
          );
        }
      }

      setPicks(restoredPicks);
      setLatestBackup(backup);
      setQuery("");
      setSearchResults([]);
      setSelectedPlayer(null);
      handleClosePickEditor();
      setError("");
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Could not restore the shared draft board.",
      );
      await loadSharedPicks({ quiet: true });
    } finally {
      setIsSyncingPicks(false);
    }
  }

  async function handleSubmitPick() {
    if (!user || !currentTeam) {
      setError("Draft room is not ready yet.");
      return;
    }

    if (isBoardLocked) {
      setError("The draft board is locked. Unlock it before making picks.");
      return;
    }

    if (!canMakeCurrentPick) {
      setError(`Only ${currentTeam.displayName} can make this pick.`);
      return;
    }

    if (!selectedPlayer) {
      setError("Search for a player and select one before submitting.");
      return;
    }

    const rosterValidation = validatePickAgainstRosterRules({
      teamId: currentTeam.id,
      picks,
      player: selectedPlayer,
    });

    if (!rosterValidation.isValid) {
      setError(rosterValidation.message);
      return;
    }

    saveBackupBeforeSharedChange(
      `Before pick ${formatPickLabel(currentPick)} - ${selectedPlayer.name}`,
    );

    try {
      setIsSyncingPicks(true);

      const updatedPicks = await updateSharedPicksFromResponse(
        await fetch("/api/picks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerId: selectedPlayer.id,
            madeByTeamId: user.teamId,
          }),
        }),
      );

      setQuery("");
      setSearchResults([]);
      setSelectedPlayer(null);
      setError("");
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error ? error.message : "Could not submit this pick.",
      );
      await loadSharedPicks({ quiet: true });
    } finally {
      setIsSyncingPicks(false);
    }
  }

  async function handleUndoLastPick() {
    if (!user?.isCommissioner) {
      return;
    }

    if (isBoardLocked) {
      setError("The draft board is locked. Unlock it before using Undo.");
      return;
    }

    saveBackupBeforeSharedChange("Before undo");

    try {
      setIsSyncingPicks(true);
      await updateSharedPicksFromResponse(
        await fetch("/api/picks/last", {
          method: "DELETE",
        }),
      );
      setQuery("");
      setSearchResults([]);
      setSelectedPlayer(null);
      handleClosePickEditor();
      setError("");
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Could not undo pick.");
      await loadSharedPicks({ quiet: true });
    } finally {
      setIsSyncingPicks(false);
    }
  }

  async function handleResetDraft() {
    if (!user?.isCommissioner) {
      return;
    }

    if (isBoardLocked) {
      setError("The draft board is locked. Unlock it before resetting.");
      return;
    }

    const confirmed = window.confirm(
      "Reset the entire shared draft board? This will remove every saved pick for everyone.",
    );

    if (!confirmed) {
      return;
    }

    saveBackupBeforeSharedChange("Before reset");

    try {
      setIsSyncingPicks(true);
      await updateSharedPicksFromResponse(
        await fetch("/api/picks", {
          method: "DELETE",
        }),
      );
      setQuery("");
      setSearchResults([]);
      setSelectedPlayer(null);
      handleClosePickEditor();
      setError("");
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error ? error.message : "Could not reset draft.",
      );
      await loadSharedPicks({ quiet: true });
    } finally {
      setIsSyncingPicks(false);
    }
  }

  function handleOpenPickEditor(pick: DraftPick) {
    if (!user?.isCommissioner) {
      return;
    }

    if (isBoardLocked) {
      setError("The draft board is locked. Unlock it before editing picks.");
      return;
    }

    setEditingPickNumber(pick.pickNumber);
    setEditingNote(pick.note ?? "");
    setReplacementQuery("");
    setReplacementResults([]);
    setReplacementPlayer(null);
    setError("");
  }

  function handleClosePickEditor() {
    setEditingPickNumber(null);
    setEditingNote("");
    setReplacementQuery("");
    setReplacementResults([]);
    setReplacementPlayer(null);
  }

  function handleSelectReplacementPlayer(player: PlayerSearchResult) {
    setReplacementPlayer(player);
    setReplacementQuery(player.name);
    setReplacementResults([]);
    setError("");
  }

  async function handleSavePickEdits() {
    if (!user?.isCommissioner || editingPickNumber === null) {
      return;
    }

    if (isBoardLocked) {
      setError("The draft board is locked. Unlock it before saving edits.");
      return;
    }

    saveBackupBeforeSharedChange(
      `Before editing pick ${formatPickLabel(editingPickNumber)}`,
    );

    try {
      setIsSyncingPicks(true);
      await updateSharedPicksFromResponse(
        await fetch(`/api/picks/${editingPickNumber}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerId: replacementPlayer?.id,
            note: editingNote,
          }),
        }),
      );
      handleClosePickEditor();
      setError("");
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error ? error.message : "Could not save pick edits.",
      );
      await loadSharedPicks({ quiet: true });
    } finally {
      setIsSyncingPicks(false);
    }
  }

  const theme = {
    page: isLightMode
      ? "bg-amber-50 text-slate-950"
      : "bg-slate-950 text-white",
    checkingPage: isLightMode
      ? "bg-amber-50 text-slate-950"
      : "bg-slate-950 text-white",
    header: isLightMode
      ? "border-slate-300 bg-white/90 shadow-xl"
      : "border-white/10 bg-white/[0.04] shadow-2xl",
    panel: isLightMode
      ? "border-slate-300 bg-white/80"
      : "border-white/10 bg-slate-950/50",
    mutedText: isLightMode ? "text-slate-600" : "text-slate-400",
    faintText: isLightMode ? "text-slate-500" : "text-slate-600",
    labelText: isLightMode ? "text-amber-700" : "text-yellow-200",
    mainText: isLightMode ? "text-slate-950" : "text-white",
    softText: isLightMode ? "text-slate-700" : "text-slate-300",
    clockBox: isLightMode
      ? "border-amber-300 bg-amber-100/80"
      : "border-yellow-300/40 bg-yellow-300/10",
    statBox: isLightMode
      ? "border-amber-300/70 bg-white/70"
      : "border-white/10 bg-slate-950/30",
    input: isLightMode
      ? "border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
      : "border-white/10 bg-slate-950/70 text-white placeholder:text-slate-600",
    dropdown: isLightMode
      ? "border-slate-300 bg-white text-slate-950"
      : "border-white/10 bg-slate-950 text-white",
    board: isLightMode
      ? "border-slate-300 bg-white shadow-xl"
      : "border-white/10 bg-slate-900 shadow-2xl",
    boardHeader: isLightMode
      ? "border-slate-300 bg-slate-800"
      : "border-white/10 bg-slate-950/80",
    boardLine: isLightMode ? "border-slate-300" : "border-white/10",
    roundCell: isLightMode
      ? "bg-slate-800 text-slate-300"
      : "bg-slate-950/60 text-slate-400",
    buttonGhost: isLightMode
      ? "border-slate-300 text-slate-700 hover:bg-slate-100"
      : "border-white/10 text-slate-300 hover:bg-white/10",
    selectedStrip: isLightMode
      ? "border-amber-300 bg-amber-100 text-slate-950"
      : "border-yellow-300/30 bg-yellow-300/10 text-white",
    tileName: isLightMode ? "text-slate-950" : "text-white",
    tileMuted: isLightMode ? "text-slate-500" : "text-slate-600",
  };

  if (isCheckingLogin) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center ${theme.checkingPage}`}
      >
        <p className={`text-sm font-bold ${theme.mutedText}`}>
          Checking draft room access...
        </p>
      </main>
    );
  }

  return (
    <main
      onPointerDown={handlePrimeBrowserAudio}
      className={`min-h-screen px-3 py-3 ${theme.page}`}
    >
      <section className="mx-auto flex max-w-[1920px] flex-col gap-3">
        <header className={`rounded-2xl border px-5 py-3 ${theme.header}`}>
          <div className="grid gap-4 xl:grid-cols-[1fr_280px_300px_520px] xl:items-center">
            <div>
              <img
                src="/interesting-league-season-18.png"
                alt="The Interesting League Season 18"
                className="max-h-32 max-w-full object-contain"
              />
            </div>

            <div
              className={`min-h-[112px] rounded-2xl border px-4 py-3 ${theme.panel}`}
            >
              {selectedPlayer ? (
                <div className="flex h-full items-center gap-3">
                  <div
                    className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${isLightMode ? "border-slate-300 bg-slate-100" : "border-white/10 bg-white/5"}`}
                  >
                    {selectedPlayer.headshot ? (
                      <img
                        src={selectedPlayer.headshot}
                        alt={selectedPlayer.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black text-slate-500">
                        {selectedPlayer.position}
                      </span>
                    )}

                    {getEspnTeamLogoUrl(selectedPlayer.nflTeam) && (
                      <img
                        src={getEspnTeamLogoUrl(selectedPlayer.nflTeam) ?? ""}
                        alt={selectedPlayer.nflTeam}
                        className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-slate-950/80 p-0.5"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.labelText}`}
                    >
                      Selected
                    </p>
                    <p
                      className={`mt-1 truncate text-lg font-black leading-tight ${theme.mainText}`}
                    >
                      {selectedPlayer.name}
                    </p>
                    <p className={`mt-1 text-xs font-bold ${theme.softText}`}>
                      {selectedPlayer.position} · {selectedPlayer.nflTeam}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center">
                  <p
                    className={`text-xs font-bold uppercase tracking-[0.25em] ${theme.faintText}`}
                  >
                    No player selected
                  </p>
                </div>
              )}
            </div>

            <div
              className={`flex min-h-[112px] items-center justify-center rounded-2xl border px-5 py-3 transition ${
                recentPickGraphic
                  ? isLightMode
                    ? "border-yellow-400 bg-yellow-100 shadow-lg shadow-yellow-300/50"
                    : "border-yellow-300 bg-yellow-300/15 shadow-lg shadow-yellow-300/30"
                  : isUsersActualTurn
                    ? theme.clockBox
                    : isLightMode
                      ? "border-slate-300 bg-white/70"
                      : "border-white/10 bg-transparent"
              }`}
            >
              {recentPickGraphic && recentPickSplitName ? (
                <div className="flex w-full items-center justify-center gap-4">
                  <div
                    className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 ${
                      isLightMode
                        ? "border-yellow-500 bg-white shadow-[0_0_18px_rgba(234,179,8,0.45)]"
                        : "border-yellow-300 bg-slate-950/80 shadow-[0_0_18px_rgba(253,224,71,0.35)]"
                    }`}
                  >
                    {recentPickPlayer?.headshot ? (
                      <img
                        src={recentPickPlayer.headshot}
                        alt={recentPickGraphic.player.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black text-slate-500">
                        {recentPickGraphic.player.position}
                      </span>
                    )}

                    {getEspnTeamLogoUrl(recentPickGraphic.player.nflTeam) && (
                      <img
                        src={
                          getEspnTeamLogoUrl(
                            recentPickGraphic.player.nflTeam,
                          ) ?? ""
                        }
                        alt={recentPickGraphic.player.nflTeam}
                        className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-slate-950/85 p-0.5"
                      />
                    )}
                  </div>

                  <div className="min-w-0 text-left">
                    <p
                      className={`inline-flex rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${
                        isLightMode
                          ? "border-yellow-500 bg-yellow-200 text-yellow-950 shadow-[0_0_12px_rgba(234,179,8,0.35)]"
                          : "border-yellow-300 bg-yellow-300/20 text-yellow-100 shadow-[0_0_12px_rgba(253,224,71,0.25)]"
                      }`}
                    >
                      The pick is in
                    </p>

                    <div className={`mt-2 leading-none ${anton.className}`}>
                      <p
                        className={`truncate text-[15px] uppercase tracking-wide ${
                          isLightMode ? "text-slate-800" : "text-slate-100"
                        }`}
                      >
                        {recentPickSplitName.firstName}
                      </p>

                      <p
                        className={`truncate text-[42px] uppercase tracking-wide ${
                          isLightMode ? "text-slate-950" : "text-white"
                        }`}
                      >
                        {recentPickSplitName.lastName ||
                          recentPickGraphic.player.name}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex justify-center">
                    <p
                      className={`inline-flex whitespace-nowrap rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${
                        isUsersActualTurn
                          ? isLightMode
                            ? "border-amber-400 bg-amber-200 text-amber-900"
                            : "border-yellow-300/30 bg-yellow-300/10 text-yellow-200"
                          : isLightMode
                            ? "border-slate-300 bg-white text-slate-600"
                            : "border-white/10 bg-transparent text-slate-400"
                      }`}
                    >
                      On the clock
                    </p>
                  </div>

                  <p
                    className={`mt-1.5 text-4xl font-black ${
                      isUsersActualTurn
                        ? isLightMode
                          ? "text-amber-800"
                          : "text-yellow-100"
                        : isLightMode
                          ? "text-slate-800"
                          : "text-slate-300"
                    }`}
                  >
                    {currentTeam?.displayName ?? "Draft Complete"}
                  </p>

                  <p className={`text-sm font-bold ${theme.softText}`}>
                    Pick {formatPickLabel(currentPick)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
              <p className={`mr-2 text-xs ${theme.mutedText}`}>
                Logged in as{" "}
                <span className={`font-black ${theme.labelText}`}>
                  {user?.displayName}
                </span>
                {user?.isCommissioner ? " · Commissioner" : ""}
              </p>

              <Link
                href="/my-team"
                className="rounded-xl border border-yellow-300/50 bg-yellow-300 px-4 py-2 text-xs font-black text-slate-950 shadow-lg shadow-yellow-300/10 transition hover:bg-yellow-200"
              >
                My Team
              </Link>

              <button
                type="button"
                onClick={handleToggleTheme}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                  isLightMode
                    ? "border-slate-300 bg-slate-900 text-white hover:bg-slate-800"
                    : "border-yellow-300/40 bg-yellow-300/10 text-yellow-100 hover:bg-yellow-300/20"
                }`}
              >
                {isLightMode ? "Dark Mode" : "Light Mode"}
              </button>

              <button
                type="button"
                onClick={handleToggleAnnouncePicks}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                  announcePicks
                    ? isLightMode
                      ? "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
                      : "border-yellow-300/40 bg-yellow-300/10 text-yellow-100 hover:bg-yellow-300/20"
                    : isLightMode
                      ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                      : "border-white/10 text-slate-300 hover:bg-white/10"
                }`}
              >
                {announcePicks ? "Announce On" : "Announce Off"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${theme.buttonGhost}`}
              >
                Log Out
              </button>

              {user?.isCommissioner && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenDraftOrderEditor}
                    disabled={!canEditDraftOrder || isSyncingPicks}
                    title={
                      picks.length > 0
                        ? "Draft order is locked after the first pick"
                        : "Change the draft order"
                    }
                    className={`rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isLightMode
                        ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                        : "border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Draft Order
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleBoardLock}
                    className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                      isBoardLocked
                        ? isLightMode
                          ? "border-red-400 bg-red-100 text-red-800 hover:bg-red-200"
                          : "border-red-400 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                        : isLightMode
                          ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                          : "border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {isBoardLocked ? "Unlock Board" : "Lock Board"}
                  </button>

                  <button
                    type="button"
                    onClick={handleUndoLastPick}
                    disabled={
                      isBoardLocked || isSyncingPicks || picks.length === 0
                    }
                    className="rounded-xl border border-red-300/30 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Undo
                  </button>

                  <button
                    type="button"
                    onClick={handleResetDraft}
                    disabled={
                      isBoardLocked || isSyncingPicks || picks.length === 0
                    }
                    className="rounded-xl border border-red-300/30 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={handleRestoreLatestBackup}
                    disabled={isBoardLocked || isSyncingPicks || !latestBackup}
                    title={
                      latestBackup
                        ? `Restore backup from ${new Date(
                            latestBackup.createdAt,
                          ).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}`
                        : "No backup saved yet"
                    }
                    className={`rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isLightMode
                        ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                        : "border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Restore
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_auto] xl:items-start">
            <div>
              <div className="grid gap-2 lg:grid-cols-[1fr_110px_120px]">
                <div className="relative">
                  <textarea
                    value={query}
                    rows={1}
                    enterKeyHint="search"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(event) => {
                      setQuery(event.target.value.replace(/\n/g, ""));
                      setSelectedPlayer(null);
                      setError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                      }
                    }}
                    className={`block h-[50px] w-full resize-none overflow-hidden rounded-xl border px-4 py-3 text-sm outline-none ${theme.input}`}
                    placeholder="Type player name, or choose position + team..."
                  />

                  {isSearching && (
                    <p className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      Searching...
                    </p>
                  )}

                  {searchResults.length > 0 && !selectedPlayer && (
                    <div
                      className={`absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border shadow-2xl ${theme.dropdown}`}
                    >
                      {searchResults.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => handleSelectPlayer(player)}
                          className={`flex w-full items-center justify-between border-b px-3 py-3 text-left transition last:border-b-0 ${isLightMode ? "border-slate-200 hover:bg-slate-100" : "border-white/10 hover:bg-white/[0.06]"}`}
                        >
                          <div>
                            <p className="text-sm font-black">{player.name}</p>
                            <p className="text-xs text-slate-500">
                              {player.position} · {player.nflTeam}
                            </p>
                          </div>

                          <span className="text-xs font-bold text-yellow-200">
                            Select
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  value={positionFilter}
                  onChange={(event) => {
                    setPositionFilter(event.target.value);
                    setSelectedPlayer(null);
                    setSearchResults([]);
                  }}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold outline-none ${theme.input}`}
                >
                  <option value="">All Pos</option>
                  {positionOptions.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>

                <select
                  value={nflTeamFilter}
                  onChange={(event) => {
                    setNflTeamFilter(event.target.value);
                    setSelectedPlayer(null);
                    setSearchResults([]);
                  }}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold outline-none ${theme.input}`}
                >
                  <option value="">All Teams</option>
                  {nflTeamOptions.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlayer && (
                <div
                  className={`mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${theme.selectedStrip}`}
                >
                  <div>
                    <p
                      className={`text-xs font-bold uppercase tracking-widest ${theme.labelText}`}
                    >
                      Selected
                    </p>
                    <p className="text-sm font-black">
                      {selectedPlayer.name}{" "}
                      <span className={theme.softText}>
                        · {selectedPlayer.position} · {selectedPlayer.nflTeam}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayer(null);
                      setQuery("");
                      setSearchResults([]);
                      setError("");
                    }}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs font-bold text-slate-300 transition hover:bg-white/10"
                  >
                    Clear
                  </button>
                </div>
              )}

              {isEditingDraftOrder && user?.isCommissioner && (
                <div className="mt-2 rounded-xl border border-yellow-300/30 bg-yellow-300/10 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-yellow-200">
                        Edit Draft Order
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-300">
                        Drag managers around, or use the arrow buttons. This locks
                        once the first pick is made.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDraftOrder}
                        disabled={isSavingDraftOrder || picks.length > 0}
                        className="rounded-lg bg-yellow-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isSavingDraftOrder ? "Saving..." : "Save Order"}
                      </button>

                      <button
                        type="button"
                        onClick={handleCloseDraftOrderEditor}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {editableDraftOrderTeamIds.map((teamId, index) => {
                      const team = getTeamById(teamId);

                      if (!team) {
                        return null;
                      }

                      return (
                        <div
                          key={teamId}
                          draggable
                          onDragStart={() => setDraggedDraftOrderTeamId(teamId)}
                          onDragEnd={() => setDraggedDraftOrderTeamId(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => moveDraggedTeamBefore(teamId)}
                          className={`flex cursor-grab items-center gap-2 rounded-xl border px-3 py-2 active:cursor-grabbing ${
                            draggedDraftOrderTeamId === teamId
                              ? "border-yellow-200 bg-yellow-300/30"
                              : "border-yellow-300/30 bg-slate-950/40"
                          }`}
                        >
                          <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-black text-slate-950">
                            {index + 1}
                          </span>

                          <span className="text-sm font-black text-white">
                            {team.displayName}
                          </span>

                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveDraftOrderTeam(teamId, -1)}
                              disabled={index === 0}
                              className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-black text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              ←
                            </button>

                            <button
                              type="button"
                              onClick={() => moveDraftOrderTeam(teamId, 1)}
                              disabled={
                                index === editableDraftOrderTeamIds.length - 1
                              }
                              className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-black text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {editingPick && user?.isCommissioner && (
                <div className="mt-2 rounded-xl border border-blue-300/30 bg-blue-400/10 px-3 py-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-200">
                        Editing Pick {formatPickLabel(editingPick.pickNumber)}
                      </p>
                      <p className="mt-1 truncate text-sm font-black">
                        Current: {editingPick.player.name}{" "}
                        <span className="text-slate-300">
                          · {editingPick.player.position} ·{" "}
                          {editingPick.player.nflTeam}
                        </span>
                      </p>

                      <input
                        value={editingNote}
                        onChange={(event) => setEditingNote(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs outline-none placeholder:text-slate-600"
                        placeholder="Add commissioner note, like via trade..."
                      />
                    </div>

                    <div className="relative min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-200">
                        Replace Player
                      </p>

                      <textarea
                        value={replacementQuery}
                        rows={1}
                        enterKeyHint="search"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        onChange={(event) => {
                          setReplacementQuery(event.target.value.replace(/\n/g, ""));
                          setReplacementPlayer(null);
                          setError("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                          }
                        }}
                        className="mt-2 block h-[34px] w-full resize-none overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs outline-none placeholder:text-slate-600"
                        placeholder="Search replacement..."
                      />

                      {isSearchingReplacement && (
                        <p className="absolute right-3 top-[34px] text-[11px] font-bold text-slate-500">
                          Searching...
                        </p>
                      )}

                      {replacementResults.length > 0 && !replacementPlayer && (
                        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-white/10 bg-slate-950 shadow-2xl">
                          {replacementResults.map((player) => (
                            <button
                              key={player.id}
                              type="button"
                              onClick={() =>
                                handleSelectReplacementPlayer(player)
                              }
                              className="flex w-full items-center justify-between border-b border-white/10 px-3 py-2 text-left transition last:border-b-0 hover:bg-white/[0.06]"
                            >
                              <div>
                                <p className="text-xs font-black">
                                  {player.name}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {player.position} · {player.nflTeam}
                                </p>
                              </div>

                              <span className="text-[11px] font-bold text-blue-200">
                                Select
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {replacementPlayer && (
                        <p className="mt-2 rounded-lg border border-blue-300/20 bg-blue-300/10 px-2 py-1.5 text-xs font-bold text-blue-100">
                          Replacement: {replacementPlayer.name} ·{" "}
                          {replacementPlayer.position} ·{" "}
                          {replacementPlayer.nflTeam}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSavePickEdits}
                        className="rounded-lg bg-blue-200 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-blue-100"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={handleClosePickEditor}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isSyncingPicks && (
                <p className="mt-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-200">
                  Syncing shared draft board...
                </p>
              )}

              {error && (
                <p className="mt-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200">
                  {error}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmitPick}
              disabled={
                isBoardLocked ||
                isSyncingPicks ||
                !canMakeCurrentPick ||
                !selectedPlayer
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{isSyncingPicks ? "Syncing..." : "Submit Pick"}</span>
              <img
                src="/football-submit-icon.png"
                alt=""
                className="h-6 w-8 object-contain"
              />
            </button>
          </div>
        </header>

        <div className={`overflow-x-auto overflow-y-hidden rounded-2xl border ${theme.board}`}>
  <div className="min-w-[1240px]">
    <div
      className={`grid grid-cols-[46px_repeat(10,minmax(108px,1fr))_46px] border-b ${theme.boardHeader}`}
    >
            <div
              className={`px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500`}
            >
              Rd
            </div>

            {draftBoard[0].map((pick) => (
              <div
                key={pick.teamId}
                className={`border-l px-1 py-1.5 text-center text-xl leading-none text-white ${isLightMode ? "border-slate-600" : "border-white/10"} ${lobster.className}`}
              >
                {pick.teamDisplayName}
              </div>
            ))}

            <div
              className={`border-l px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest ${isLightMode ? "border-slate-600 text-slate-300" : "border-white/10 text-slate-500"}`}
            >
              Rd
            </div>
          </div>

          {draftBoard.map((roundPicks) => (
            <div
              key={roundPicks[0].round}
              className={`grid grid-cols-[46px_repeat(10,minmax(108px,1fr))_46px] border-b last:border-b-0 ${theme.boardLine}`}
            >
              <div
                className={`flex items-center justify-center text-sm font-black ${theme.roundCell}`}
              >
                {roundPicks[0].round}
              </div>

              {roundPicks.map((pick) => {
                const savedPick = getPickByNumber(picks, pick.pickNumber);
                const isCurrentPick = pick.pickNumber === currentPick;
                const isEditingPick = editingPickNumber === pick.pickNumber;
                const splitName = savedPick
                  ? splitPlayerName(savedPick.player.name)
                  : null;

                return (
                  <button
                    key={`${pick.round}-${pick.slot}`}
                    type="button"
                    onClick={() => {
                      if (savedPick) {
                        handleOpenPickEditor(savedPick);
                      }
                    }}
                    disabled={!user?.isCommissioner || !savedPick}
                    className={`min-h-[68px] border-l p-1 text-left ${theme.boardLine} ${
                      isCurrentPick ? "bg-yellow-300/10" : ""
                    } ${
                      user?.isCommissioner && savedPick
                        ? "cursor-pointer hover:bg-white/[0.04]"
                        : "cursor-default"
                    } disabled:cursor-default`}
                  >
                    <div
                      className={`flex h-full flex-col justify-between rounded-lg border px-2 py-1.5 ${getPositionClass(
                        savedPick?.player.position,
                      )} ${
                        isCurrentPick
                          ? "ring-2 ring-yellow-300 ring-offset-1 ring-offset-slate-900"
                          : ""
                      } ${
                        isEditingPick
                          ? "ring-2 ring-blue-300 ring-offset-1 ring-offset-slate-900"
                          : ""
                      }`}
                    >
                      {savedPick && splitName ? (
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center justify-between gap-1">
                            <span
                              className={`text-[10px] font-black leading-none ${isLightMode ? "text-slate-600" : "text-slate-400"}`}
                            >
                              {formatPickLabel(pick.pickNumber)}
                            </span>

                            <div className="flex min-w-0 items-center gap-1">
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${isLightMode ? "bg-white/70 text-slate-900" : "bg-black/30"}`}
                              >
                                {savedPick.player.position}
                              </span>

                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${isLightMode ? "bg-white/60 text-slate-700" : "bg-black/20 text-slate-300"}`}
                              >
                                {savedPick.player.nflTeam}
                              </span>
                            </div>
                          </div>

                          <div className={`text-center ${anton.className}`}>
                            <p
                              className={`truncate text-[12px] uppercase leading-[1.05] tracking-wide ${theme.tileName}`}
                            >
                              {splitName.firstName}
                            </p>

                            <p
                              className={`truncate text-[20px] uppercase leading-[1.05] tracking-wide ${theme.tileName}`}
                            >
                              {splitName.lastName || savedPick.player.name}
                            </p>
                          </div>

                          {savedPick.note && (
                            <p className="mt-1 truncate text-[9px] font-bold leading-none text-blue-200">
                              {savedPick.note}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p
                            className={`text-[11px] font-black leading-tight ${isLightMode ? "text-slate-600" : "text-slate-500"}`}
                          >
                            {formatPickLabel(pick.pickNumber)}
                          </p>
                          <p
                            className={`mt-0.5 truncate text-[10px] leading-none ${theme.tileMuted}`}
                          >
                            {pick.teamDisplayName}
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              <div
                className={`flex items-center justify-center border-l text-sm font-black ${isLightMode ? "border-slate-600" : "border-white/10"} ${theme.roundCell}`}
              >
                {roundPicks[0].round}
              </div>
            </div>
          ))}

          <div
            className={`grid grid-cols-[46px_repeat(10,minmax(108px,1fr))_46px] border-t ${theme.boardHeader}`}
          >
            <div
              className={`px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500`}
            >
              Rd
            </div>

            {draftBoard[0].map((pick) => (
              <div
                key={`bottom-${pick.teamId}`}
                className={`border-l px-1 py-1.5 text-center text-xl leading-none text-white ${isLightMode ? "border-slate-600" : "border-white/10"} ${lobster.className}`}
              >
                {pick.teamDisplayName}
              </div>
            ))}

            <div
              className={`border-l px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest ${isLightMode ? "border-slate-600 text-slate-300" : "border-white/10 text-slate-500"}`}
            >
              Rd
            </div>
              </div>
  </div>
</div>
</section>
    </main>
  );
}
