import pygame
import sys
import math
import random

pygame.init()

# Fenster
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Top-Down Drifter")

clock = pygame.time.Clock()
FPS = 60


# ================= FARBEN =================
# UI & Alte Farben (für Menü-Kompatibilität)
BEIGE = (232, 194, 150)
BORDER = (120, 60, 20)
OBSTACLE_OUTER = (140, 70, 25)
OBSTACLE_MID = (190, 120, 70)
WHITE = (255, 255, 255)
KHAKI = (120, 140, 70)
DARK_BROWN = (70, 40, 20)
YELLOW = (255, 220, 90)
RELAXED_RED = (180, 60, 60)
RED = (230, 60, 60)

# Neue Farben (Night Racing Look)
TRACK_BG = (30, 32, 36)
GRID_COLOR = (50, 52, 58)
RIMAC_BLUE = (0, 85, 180)
RIMAC_DARK = (0, 40, 90)
RIMAC_LIGHT = (60, 120, 220) # Highlight Farbe
CAR_WINDOW = (40, 40, 60)
NEON_CYAN = (0, 255, 255)
BARREL_RED = (220, 40, 40)
BARREL_WHITE = (220, 220, 220)
FLAME1 = (0, 200, 255)
FLAME2 = (200, 255, 255)

# Verfügbare Farben für die Auswahl
CAR_COLORS = [
    (230, 60, 60),   # Rot
    (135, 235, 60),  # Kiwi Grün
    (0, 85, 180),    # Blau (Standard)
    (255, 220, 0),   # Gelb
    (255, 140, 0),   # Orange
    (140, 0, 200),   # Lila
    (0, 255, 255),   # Cyan
    (255, 0, 255),   # Magenta
    (200, 200, 200), # Silber
    (50, 50, 50),    # Dunkelgrau
    (255, 105, 180), # Pink
    (128, 128, 0)    # Oliv
]

def generate_full_palette(base_colors):
    palette = []
    # 3 Lighter rows (Lightest to less light)
    factors = [0.8, 0.6, 0.3] # Mixing with white
    for f in factors:
        for col in base_colors:
            r = int(col[0] + (255 - col[0]) * f)
            g = int(col[1] + (255 - col[1]) * f)
            b = int(col[2] + (255 - col[2]) * f)
            palette.append((r, g, b))
            
    # Base Row
    palette.extend(base_colors)
    
    # 3 Darker rows (Less dark to darkest)
    factors = [0.8, 0.6, 0.4] # Multiplier
    for f in factors:
        for col in base_colors:
            r = int(col[0] * f)
            g = int(col[1] * f)
            b = int(col[2] * f)
            palette.append((r, g, b))
    return palette

FULL_PALETTE = generate_full_palette(CAR_COLORS)

# ================= AUTO (UNVERÄNDERT) =================
car_length = 40
car_width = 20
car_pos = pygame.Vector2(WIDTH // 2, HEIGHT // 2)
car_angle = 0
velocity = 0

max_speed = 6.3
acceleration = 0.3
friction = 0.05
turn_speed = 3.5
drift_factor = 0.85

STOP_FRICTION = 0.35


# ================= FLAMME =================
flame_particles = []


# ================= HINDERNISSE =================
offset_x, offset_y = 180, 140
radius = int(15 * 2.5)

MAPS = [
    {
        "name": "Classic Corners",
        "pos": [
            pygame.Vector2(offset_x, offset_y),
            pygame.Vector2(WIDTH - offset_x, offset_y),
            pygame.Vector2(offset_x, HEIGHT - offset_y),
            pygame.Vector2(WIDTH - offset_x, HEIGHT - offset_y),
        ],
        "spawn": pygame.Vector2(WIDTH // 2, HEIGHT // 2)
    },
    {
        "name": "Slalom Drift",
        "pos": [
            pygame.Vector2(WIDTH // 2, 150),
            pygame.Vector2(WIDTH // 2, 300),
            pygame.Vector2(WIDTH // 2, 450),
        ],
        "spawn": pygame.Vector2(150, HEIGHT // 2)
    },
    {
        "name": "The Arena",
        "pos": [
            pygame.Vector2(WIDTH // 2 + 160 * math.cos(a), HEIGHT // 2 + 160 * math.sin(a))
            for a in [0, math.pi/3, 2*math.pi/3, math.pi, 4*math.pi/3, 5*math.pi/3]
        ],
        "spawn": pygame.Vector2(WIDTH // 2, HEIGHT // 2)
    },
    {
        "name": "Gatekeeper",
        "pos": [
            pygame.Vector2(200, HEIGHT // 2),
            pygame.Vector2(WIDTH - 200, HEIGHT // 2),
            pygame.Vector2(WIDTH // 2, 120),
            pygame.Vector2(WIDTH // 2, HEIGHT - 120),
        ],
        "spawn": pygame.Vector2(WIDTH // 2, HEIGHT // 2)
    },
    {
        "name": "Chaos Theory",
        "pos": [
            pygame.Vector2(WIDTH // 2, HEIGHT // 2),
            pygame.Vector2(250, 200),
            pygame.Vector2(WIDTH - 250, 200),
            pygame.Vector2(250, HEIGHT - 200),
            pygame.Vector2(WIDTH - 250, HEIGHT - 200),
        ],
        "spawn": pygame.Vector2(100, 100)
    }
]

THEMES = [
    {"name": "Night", "bg": (30, 32, 36), "grid": (50, 52, 58), "border": (180, 180, 180)},
    {"name": "Day", "bg": (210, 210, 200), "grid": (180, 180, 170), "border": (100, 100, 100)},
    {"name": "Neon", "bg": (10, 10, 20), "grid": (200, 0, 200), "border": (0, 255, 255)},
    {"name": "Desert", "bg": (232, 194, 150), "grid": (210, 170, 130), "border": (120, 60, 20)},
    {"name": "Ice", "bg": (220, 240, 255), "grid": (180, 210, 230), "border": (100, 150, 200)},
]

CAR_MODELS = [
    {"id": 3, "name": "Muscle"},
    {"id": 2, "name": "Sport"},
    {"id": 1, "name": "Buggy"},
    {"id": 4, "name": "Van"},
    {"id": 5, "name": "Formula"},
]

selected_map_index = 0
selected_theme_index = 3 # Desert Theme als Standard
obstacles = MAPS[selected_map_index]["pos"]
obstacle_shape = "circle" # circle, square, triangle
obstacle_color = FULL_PALETTE[64] # Braun (Orange Spalte, 2. von unten)

# ================= SCORE =================
score = 0
collectible_radius = 10
score_history = []  # Liste für (Score, Zeit-Modus)
selected_time = 30  # Standardauswahl
game_start_time = 0
selected_car = 1    # 1=Buggy
selected_car_index = 2 # Buggy ist jetzt in der Mitte (Index 2)
selected_color = FULL_PALETTE[47] # Oliv-Grün (Ganz rechts, Mitte)
selected_boost_color = FULL_PALETTE[83]  # Dunkel-Oliv (Ganz rechts, ganz unten)


def spawn_collectible():
    """Spawn mit Abstand zu Hindernissen"""
    while True:
        pos = pygame.Vector2(
            random.randint(80, WIDTH - 80),
            random.randint(80, HEIGHT - 80),
        )

        ok = True
        for o in obstacles:
            if pos.distance_to(o) < radius + 40:
                ok = False
        if ok:
            return pos


collectible_pos = spawn_collectible()


# ================= RAHMEN =================
border_thickness = 14
border_rect = pygame.Rect(10, 10, WIDTH - 20, HEIGHT - 20)
border_radius = 35


# ================= STATE =================
state = "menu"

# Buttons (Rechtecke für Klick-Erkennung)
btn_start = pygame.Rect(0, 0, 200, 60)
time_buttons = []
btn_select_car = pygame.Rect(0, 0, 180, 50)
btn_select_map = pygame.Rect(0, 0, 180, 50)
btn_back = pygame.Rect(0, 0, 200, 50)
btn_background_settings = pygame.Rect(0, 0, 380, 50)
time_options = [10, 15, 20, 30, 40, 50, 60]
car_select_rects = [] # Wird in draw_car_select gefüllt
btn_car_color_select = pygame.Rect(0, 0, 160, 50)
btn_boost_color_select = pygame.Rect(0, 0, 160, 50)
color_choice_rects = [] # Die 12 Farbfelder
shape_buttons = [] # Für Map Settings
map_nav_buttons = [] # Prev/Next Map
theme_nav_buttons = [] # Prev/Next Theme
bg_category_rects = []
bg_option_rects = []
btn_obstacle_settings = pygame.Rect(0, 0, 220, 50) # Button für Untermenü

# ================= HINTERGRÜNDE =================
bg_states = {} # Speicher für Animationen

def get_bg_state(key):
    if key not in bg_states: bg_states[key] = []
    return bg_states[key]

# --- Generic Helpers ---
def draw_grid_perspective(surf, color, speed=1.0):
    t = pygame.time.get_ticks() * 0.002 * speed
    h = HEIGHT
    w = WIDTH
    # Horizon
    pygame.draw.line(surf, color, (0, h//3), (w, h//3), 2)
    # Vertical lines
    for i in range(-10, 20):
        x = (i * 100 + t * 50) % (w * 2) - w * 0.5
        # Perspective projection roughly
        top_x = w//2 + (x - w//2) * 0.2
        pygame.draw.line(surf, color, (top_x, h//3), (x, h), 1)
    # Horizontal lines
    for i in range(10):
        y_off = (t * 20 + i * 40) % 400
        y = h//3 + y_off * (y_off/400) # Exponential spacing
        if y < h:
            pygame.draw.line(surf, color, (0, y), (w, y), 1)

# --- MENU BACKGROUNDS ---
def bg_menu_particles(surf):
    surf.fill((20, 20, 25))
    particles = get_bg_state("menu_particles")
    if not particles:
        for _ in range(80):
            particles.append([pygame.Vector2(random.randint(0, WIDTH), random.randint(0, HEIGHT)), 
                              pygame.Vector2(random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5)),
                              random.randint(2, 4), random.choice([(50, 50, 80), (80, 50, 50), (50, 80, 50)])])
    for p in particles:
        p[0] += p[1]
        if p[0].x < 0: p[0].x = WIDTH
        if p[0].x > WIDTH: p[0].x = 0
        if p[0].y < 0: p[0].y = HEIGHT
        if p[0].y > HEIGHT: p[0].y = 0
        pygame.draw.circle(surf, p[3], p[0], p[2])

def bg_menu_neon(surf):
    surf.fill((10, 0, 20))
    draw_grid_perspective(surf, (200, 0, 200))
    # Sun
    pygame.draw.circle(surf, (255, 100, 0), (WIDTH//2, HEIGHT//3 - 50), 60)
    pygame.draw.rect(surf, (10, 0, 20), (0, HEIGHT//3, WIDTH, HEIGHT)) # Cut bottom of sun

def bg_menu_traffic(surf):
    surf.fill((30, 30, 30))
    cars = get_bg_state("menu_traffic")
    if not cars:
        for i in range(5): cars.append([random.randint(0, WIDTH), random.randint(100, 500), random.uniform(2, 5), (random.randint(100,255), random.randint(100,255), random.randint(100,255))])
    
    for c in cars:
        c[0] += c[2]
        if c[0] > WIDTH + 50: 
            c[0] = -50
            c[1] = random.randint(100, 500)
            c[3] = (random.randint(100,255), random.randint(100,255), random.randint(100,255))
        
        # Draw simple car
        rect = pygame.Rect(c[0], c[1], 40, 20)
        pygame.draw.rect(surf, c[3], rect, border_radius=4)
        # Lights
        pygame.draw.rect(surf, (255, 255, 200), (rect.right, rect.top+2, 10, 5))
        pygame.draw.rect(surf, (255, 255, 200), (rect.right, rect.bottom-7, 10, 5))
        # Red lights
        pygame.draw.rect(surf, (255, 0, 0), (rect.left-2, rect.top+2, 2, 5))
        pygame.draw.rect(surf, (255, 0, 0), (rect.left-2, rect.bottom-7, 2, 5))

def bg_menu_stars(surf):
    surf.fill((5, 5, 10))
    stars = get_bg_state("menu_stars")
    if not stars:
        for _ in range(100): stars.append([random.randint(0, WIDTH), random.randint(0, HEIGHT), random.uniform(0.5, 2)])
    for s in stars:
        s[0] -= s[2]
        if s[0] < 0: s[0] = WIDTH
        col = int(150 + s[2]*50)
        pygame.draw.circle(surf, (col, col, col), (int(s[0]), int(s[1])), 1)

def bg_menu_rain(surf):
    surf.fill((10, 15, 20))
    drops = get_bg_state("menu_rain")
    if not drops:
        for _ in range(100): drops.append([random.randint(0, WIDTH), random.randint(0, HEIGHT), random.randint(5, 15)])
    for d in drops:
        d[1] += d[2]
        if d[1] > HEIGHT: d[1] = -10; d[0] = random.randint(0, WIDTH)
        pygame.draw.line(surf, (100, 120, 150), (d[0], d[1]), (d[0], d[1]+10), 1)

# --- GARAGE BACKGROUNDS ---
def bg_garage_blueprint(surf):
    surf.fill((0, 50, 100))
    for x in range(0, WIDTH, 50): pygame.draw.line(surf, (255, 255, 255, 50), (x, 0), (x, HEIGHT), 1)
    for y in range(0, HEIGHT, 50): pygame.draw.line(surf, (255, 255, 255, 50), (0, y), (WIDTH, y), 1)
    pygame.draw.circle(surf, (255, 255, 255), (WIDTH//2, HEIGHT//2), 150, 2)
    pygame.draw.line(surf, (255, 255, 255), (WIDTH//2 - 160, HEIGHT//2), (WIDTH//2 + 160, HEIGHT//2), 1)
    pygame.draw.line(surf, (255, 255, 255), (WIDTH//2, HEIGHT//2 - 160), (WIDTH//2, HEIGHT//2 + 160), 1)

def bg_garage_spotlight(surf):
    surf.fill((20, 20, 20))
    t = pygame.time.get_ticks() * 0.001
    x1 = WIDTH//2 + math.sin(t) * 200
    x2 = WIDTH//2 + math.sin(t + 2) * 200
    # Draw "light" cones (transparent shapes)
    s = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    pygame.draw.polygon(s, (255, 255, 200, 30), [(x1, 0), (WIDTH//2 - 100, HEIGHT), (WIDTH//2 + 100, HEIGHT)])
    pygame.draw.polygon(s, (200, 200, 255, 30), [(x2, 0), (WIDTH//2 - 100, HEIGHT), (WIDTH//2 + 100, HEIGHT)])
    surf.blit(s, (0,0))

def bg_garage_hex(surf):
    surf.fill((30, 30, 35))
    t = pygame.time.get_ticks() * 0.002
    for y in range(0, HEIGHT + 40, 60):
        for x in range(0, WIDTH + 40, 60):
            off = 30 if (y // 60) % 2 == 0 else 0
            val = math.sin(x * 0.01 + y * 0.01 + t)
            col = 40 + int(val * 20)
            pygame.draw.circle(surf, (col, col, col+10), (x + off, y), 25, 2)

def bg_garage_smoke(surf):
    surf.fill((10, 10, 10))
    parts = get_bg_state("garage_smoke")
    if not parts:
        for _ in range(50): parts.append([random.randint(0, WIDTH), random.randint(HEIGHT-100, HEIGHT), random.randint(20, 50), random.uniform(0.5, 2)])
    for p in parts:
        p[1] -= p[3]
        p[2] += 0.1
        if p[1] < -50: p[1] = HEIGHT + 50; p[0] = random.randint(0, WIDTH); p[2] = random.randint(20, 50)
        s = pygame.Surface((int(p[2]*2), int(p[2]*2)), pygame.SRCALPHA)
        pygame.draw.circle(s, (50, 50, 50, 10), (int(p[2]), int(p[2])), int(p[2]))
        surf.blit(s, (p[0]-p[2], p[1]-p[2]))

def bg_garage_scan(surf):
    surf.fill((0, 20, 0))
    for x in range(0, WIDTH, 40): pygame.draw.line(surf, (0, 50, 0), (x, 0), (x, HEIGHT), 1)
    y = (pygame.time.get_ticks() * 0.2) % HEIGHT
    pygame.draw.line(surf, (0, 255, 0), (0, y), (WIDTH, y), 2)
    s = pygame.Surface((WIDTH, 40), pygame.SRCALPHA)
    s.fill((0, 255, 0, 50))
    surf.blit(s, (0, y-20))

# --- MAP BACKGROUNDS ---
def bg_map_radar(surf):
    surf.fill((0, 20, 10))
    cx, cy = WIDTH//2, HEIGHT//2
    pygame.draw.circle(surf, (0, 80, 40), (cx, cy), 200, 2)
    pygame.draw.circle(surf, (0, 80, 40), (cx, cy), 100, 1)
    pygame.draw.line(surf, (0, 80, 40), (cx-200, cy), (cx+200, cy), 1)
    pygame.draw.line(surf, (0, 80, 40), (cx, cy-200), (cx, cy+200), 1)
    angle = (pygame.time.get_ticks() * 0.1) % 360
    rad = math.radians(angle)
    end_x = cx + math.cos(rad) * 200
    end_y = cy + math.sin(rad) * 200
    pygame.draw.line(surf, (0, 255, 0), (cx, cy), (end_x, end_y), 2)

def bg_map_digital(surf):
    surf.fill((10, 10, 15))
    bits = get_bg_state("map_bits")
    if not bits:
        for _ in range(100): bits.append([random.randint(0, WIDTH//20)*20, random.randint(0, HEIGHT//20)*20, random.randint(0, 1)])
    if random.random() < 0.1:
        bits[random.randint(0, 99)] = [random.randint(0, WIDTH//20)*20, random.randint(0, HEIGHT//20)*20, random.randint(0, 1)]
    for b in bits:
        col = (0, 100, 0) if b[2] else (0, 50, 0)
        txt = font_tiny.render(str(b[2]), True, col)
        surf.blit(txt, (b[0], b[1]))

def bg_map_topo(surf):
    surf.fill((30, 30, 30))
    t = pygame.time.get_ticks() * 0.001
    for i in range(5):
        pts = []
        for x in range(0, WIDTH + 20, 20):
            y = HEIGHT//2 + math.sin(x * 0.01 + t + i) * 50 + (i-2)*60
            pts.append((x, y))
        if len(pts) > 1: pygame.draw.lines(surf, (100, 100, 100), False, pts, 2)

def bg_map_gridwave(surf):
    surf.fill((20, 0, 20))
    t = pygame.time.get_ticks() * 0.002
    for y in range(0, HEIGHT, 40):
        for x in range(0, WIDTH, 40):
            off_x = math.sin(y * 0.01 + t) * 10
            off_y = math.cos(x * 0.01 + t) * 10
            pygame.draw.circle(surf, (50, 0, 50), (x + off_x, y + off_y), 2)

def bg_map_static(surf):
    surf.fill((40, 40, 40))
    for _ in range(500):
        x, y = random.randint(0, WIDTH), random.randint(0, HEIGHT)
        c = random.randint(40, 60)
        surf.set_at((x, y), (c, c, c))

# --- SCOREBOARD BACKGROUNDS ---
def bg_score_confetti(surf):
    surf.fill((20, 20, 25))
    conf = get_bg_state("score_conf")
    if not conf:
        for _ in range(100): conf.append([random.randint(0, WIDTH), random.randint(-HEIGHT, 0), random.choice([RED, YELLOW, NEON_CYAN, (0,255,0)]), random.randint(2, 5)])
    for c in conf:
        c[1] += c[3]
        if c[1] > HEIGHT: c[1] = -10; c[0] = random.randint(0, WIDTH)
        pygame.draw.rect(surf, c[2], (c[0], c[1], 5, 5))

def bg_score_fireworks(surf):
    surf.fill((10, 10, 20))
    fw = get_bg_state("score_fw") # list of [x, y, radius, color, max_radius]
    if random.random() < 0.05:
        fw.append([random.randint(100, WIDTH-100), random.randint(100, HEIGHT-100), 0, random.choice([RED, YELLOW, NEON_CYAN]), random.randint(50, 150)])
    for f in fw[:]:
        f[2] += 2
        pygame.draw.circle(surf, f[3], (f[0], f[1]), int(f[2]), 2)
        if f[2] >= f[4]: fw.remove(f)

def bg_score_gold(surf):
    surf.fill((50, 40, 0))
    parts = get_bg_state("score_gold")
    if not parts:
        for _ in range(50): parts.append([random.randint(0, WIDTH), random.randint(0, HEIGHT), random.randint(1, 3)])
    for p in parts:
        p[1] -= 1
        if p[1] < 0: p[1] = HEIGHT; p[0] = random.randint(0, WIDTH)
        col = random.randint(150, 255)
        pygame.draw.circle(surf, (col, col, 0), (p[0], p[1]), p[2])

def bg_score_matrix(surf):
    surf.fill((0, 0, 0))
    drops = get_bg_state("score_matrix")
    if not drops:
        for x in range(0, WIDTH, 20): drops.append([x, random.randint(-HEIGHT, 0)])
    for d in drops:
        d[1] += 5
        if d[1] > HEIGHT: d[1] = random.randint(-200, -20)
        for i in range(5):
            y = d[1] - i * 15
            if 0 <= y < HEIGHT:
                col = (0, 255 - i*40, 0)
                txt = font_tiny.render(chr(random.randint(33, 126)), True, col)
                surf.blit(txt, (d[0], y))

def bg_score_spotlights(surf):
    surf.fill((20, 20, 30))
    t = pygame.time.get_ticks() * 0.002
    for i in range(3):
        x = WIDTH//4 * (i+1)
        angle = math.sin(t + i) * 0.5
        end_x = x + math.sin(angle) * 400
        end_y = HEIGHT//2 - math.cos(angle) * 400
        pygame.draw.line(surf, (255, 255, 255), (x, HEIGHT), (end_x, end_y), 2)
        s = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        pygame.draw.polygon(s, (255, 255, 255, 20), [(x, HEIGHT), (end_x-20, end_y), (end_x+20, end_y)])
        surf.blit(s, (0,0))

BG_CATEGORIES = {
    "menu": {
        "name": "Main Menu", "selected": 0, 
        "options": [
            {"name": "Particle Swarm", "func": bg_menu_particles},
            {"name": "Neon City", "func": bg_menu_neon},
            {"name": "Traffic Flow", "func": bg_menu_traffic},
            {"name": "Starfield", "func": bg_menu_stars},
            {"name": "Digital Rain", "func": bg_menu_rain}
        ]
    },
    "garage": {
        "name": "Garage", "selected": 0,
        "options": [
            {"name": "Blueprint", "func": bg_garage_blueprint},
            {"name": "Spotlights", "func": bg_garage_spotlight},
            {"name": "Hex Tech", "func": bg_garage_hex},
            {"name": "Smoke", "func": bg_garage_smoke},
            {"name": "Scanner", "func": bg_garage_scan}
        ]
    },
    "map": {
        "name": "Map Editor", "selected": 0,
        "options": [
            {"name": "Radar", "func": bg_map_radar},
            {"name": "Digital Bits", "func": bg_map_digital},
            {"name": "Topography", "func": bg_map_topo},
            {"name": "Grid Waves", "func": bg_map_gridwave},
            {"name": "Static", "func": bg_map_static}
        ]
    },
    "score": {
        "name": "Scoreboard", "selected": 0,
        "options": [
            {"name": "Confetti", "func": bg_score_confetti},
            {"name": "Fireworks", "func": bg_score_fireworks},
            {"name": "Gold Rush", "func": bg_score_gold},
            {"name": "Matrix", "func": bg_score_matrix},
            {"name": "Spotlights", "func": bg_score_spotlights}
        ]
    }
}

current_bg_category = "menu"

def draw_current_bg(category):
    idx = BG_CATEGORIES[category]["selected"]
    BG_CATEGORIES[category]["options"][idx]["func"](screen)

# ================= ZEICHNEN =================

def draw_background(surf=screen):
    theme = THEMES[selected_theme_index]
    surf.fill(theme["bg"])
    
    # Gittermuster zeichnen
    grid_size = 60
    for x in range(0, WIDTH, grid_size):
        pygame.draw.line(surf, theme["grid"], (x, 0), (x, HEIGHT), 1)
    for y in range(0, HEIGHT, grid_size):
        pygame.draw.line(surf, theme["grid"], (0, y), (WIDTH, y), 1)

    # Rahmen (Leitplanke)
    # Rahmen (Leitplanke) - im Stil der Hindernisse
    # Hauptfarbe als dicker Rahmen
    pygame.draw.rect(surf, obstacle_color, border_rect, border_thickness, border_radius)
    # Weißer Streifen in der Mitte
    pygame.draw.rect(surf, BARREL_WHITE, border_rect, border_thickness - 8, border_radius)


def draw_single_obstacle(surf, pos, shape, color, bg_color):
    """Hilfsfunktion zum Zeichnen eines einzelnen Hindernisses"""
    shadow_pos = (int(pos.x + 4), int(pos.y + 4))
    
    if shape == "circle":
        # Schatten
        pygame.draw.circle(surf, (10, 10, 10), shadow_pos, radius)
        # Reifenstapel / Fass Look
        pygame.draw.circle(surf, color, pos, radius)
        pygame.draw.circle(surf, BARREL_WHITE, pos, radius - 6)
        pygame.draw.circle(surf, color, pos, radius - 12)
        pygame.draw.circle(surf, bg_color, pos, radius - 18)
        
    elif shape == "square":
        r = radius
        rect = pygame.Rect(pos.x - r, pos.y - r, r*2, r*2)
        shadow_rect = pygame.Rect(pos.x - r + 4, pos.y - r + 4, r*2, r*2)
        
        pygame.draw.rect(surf, (10, 10, 10), shadow_rect, border_radius=4)
        pygame.draw.rect(surf, color, rect, border_radius=4)
        pygame.draw.rect(surf, BARREL_WHITE, rect.inflate(-12, -12), 2, border_radius=4)
        pygame.draw.rect(surf, bg_color, rect.inflate(-24, -24), border_radius=4)
        
    elif shape == "triangle":
        # Dreieck berechnen
        r = radius * 1.2
        pts = [
            (pos.x, pos.y - r),
            (pos.x - r * 0.866, pos.y + r * 0.5),
            (pos.x + r * 0.866, pos.y + r * 0.5)
        ]
        shadow_pts = [(p[0]+4, p[1]+4) for p in pts]
        
        pygame.draw.polygon(surf, (10, 10, 10), shadow_pts)
        pygame.draw.polygon(surf, color, pts)
        pygame.draw.polygon(surf, BARREL_WHITE, pts, 3)

def draw_obstacles(surf=screen):
    theme_bg = THEMES[selected_theme_index]["bg"]
    for o in obstacles:
        draw_single_obstacle(surf, o, obstacle_shape, obstacle_color, theme_bg)


def draw_collectible():
    # Pulsierender Effekt
    pulse = math.sin(pygame.time.get_ticks() * 0.008) * 3
    current_radius = collectible_radius + pulse
    
    # Leuchten (mehrere Kreise übereinander)
    pygame.draw.circle(screen, (0, 100, 100), collectible_pos, int(current_radius + 4))
    pygame.draw.circle(screen, NEON_CYAN, collectible_pos, int(current_radius))
    pygame.draw.circle(screen, WHITE, collectible_pos, int(current_radius - 5))


def draw_score():
    box = pygame.Rect(0, 0, 80, 40)
    box.center = (WIDTH // 2, HEIGHT // 2)

    pygame.draw.rect(screen, (0, 0, 0), box, border_radius=8)
    pygame.draw.rect(screen, WHITE, box, 2, border_radius=8)

    txt = font_small.render(str(score), True, WHITE)
    screen.blit(txt, txt.get_rect(center=box.center))

    # Timer anzeigen
    elapsed = (pygame.time.get_ticks() - game_start_time) / 1000
    remaining = max(0.0, selected_time - elapsed)
    timer_surf = font_small.render(f"{remaining:.1f}s", True, WHITE)
    screen.blit(timer_surf, (WIDTH - 100, 20))

    # Exit hint
    exit_surf = font_tiny.render("Press ENTER to leave", True, WHITE)
    screen.blit(exit_surf, exit_surf.get_rect(topright=(WIDTH - 20, 60)))


def draw_car(pos, angle, boosting=False, surf=screen, override_car=None, override_color=None):
    rad = math.radians(angle)
    dir_vec = pygame.Vector2(math.cos(rad), math.sin(rad))
    ortho = pygame.Vector2(-dir_vec.y, dir_vec.x)

    # Dynamische Farben basierend auf Auswahl berechnen
    body_col = override_color if override_color else selected_color
    # Dunklere Variante für Akzente/Schatten
    dark_col = (
        max(0, int(body_col[0] * 0.4)),
        max(0, int(body_col[1] * 0.4)),
        max(0, int(body_col[2] * 0.4))
    )
    # Hellere Variante für Highlights
    light_col = (
        min(255, int(body_col[0] * 1.5)),
        min(255, int(body_col[1] * 1.5)),
        min(255, int(body_col[2] * 1.5))
    )

    car_type = override_car if override_car else selected_car

    # ================= CAR 1: BUGGY (ehem. Octane) =================
    if car_type == 1:
        # Buggy/RC Car Look
        
        # 1. Räder (Freistehend)
        front_dist = 15  # Nach hinten versetzt (war 22)
        rear_dist = 22
        wheel_dist_width = 13  # Näher am Auto (war 16)
        wheel_len = 14
        wheel_width = 12
        
        wheels = [
            pos + dir_vec * front_dist + ortho * wheel_dist_width, # FL
            pos + dir_vec * front_dist - ortho * wheel_dist_width, # FR
            pos - dir_vec * rear_dist + ortho * (wheel_dist_width + 2), # RL
            pos - dir_vec * rear_dist - ortho * (wheel_dist_width + 2)  # RR
        ]
        
        # Fahrwerk (Verbindungen)
        for w in wheels:
            pygame.draw.line(surf, (40, 40, 40), pos, w, 4)

        # Räder zeichnen
        for w in wheels:
            c1 = w + dir_vec * (wheel_len/2) + ortho * (wheel_width/2)
            c2 = w + dir_vec * (wheel_len/2) - ortho * (wheel_width/2)
            c3 = w - dir_vec * (wheel_len/2) - ortho * (wheel_width/2)
            c4 = w - dir_vec * (wheel_len/2) + ortho * (wheel_width/2)
            pygame.draw.polygon(surf, (20, 20, 25), [c1, c2, c3, c4])
            # Felge
            pygame.draw.line(surf, (100, 100, 100), w + dir_vec*4, w - dir_vec*4, 2)

        # 2. Karosserie (Keilform)
        nose = pos + dir_vec * 25
        front_w = pos + dir_vec * 15
        waist = pos - dir_vec * 5
        rear = pos - dir_vec * 20
        
        body_pts = [
            nose,
            front_w - ortho * 10,
            waist - ortho * 8,
            rear - ortho * 12,
            rear - dir_vec * 5, # Heck Mitte
            rear + ortho * 12,
            waist + ortho * 8,
            front_w + ortho * 10
        ]
        
        # Schatten & Body
        pygame.draw.polygon(surf, (0,0,0), [p + pygame.Vector2(4,4) for p in body_pts])
        pygame.draw.polygon(surf, body_col, body_pts)
        
        # Streifen (Decal)
        pygame.draw.polygon(surf, light_col, [nose, waist - ortho*4, waist + ortho*4])

        # 3. Kabine / Dach
        roof_pts = [
            pos + dir_vec * 5 + ortho * 6,
            pos + dir_vec * 5 - ortho * 6,
            pos - dir_vec * 12 - ortho * 7,
            pos - dir_vec * 12 + ortho * 7
        ]
        pygame.draw.polygon(surf, CAR_WINDOW, roof_pts)
        pygame.draw.polygon(surf, dark_col, roof_pts, 2)

        # 4. Spoiler
        spoiler_pos = rear - dir_vec * 8
        pygame.draw.line(surf, (50,50,50), rear + ortho*8, spoiler_pos + ortho*10, 3)
        pygame.draw.line(surf, (50,50,50), rear - ortho*8, spoiler_pos - ortho*10, 3)
        pygame.draw.polygon(surf, dark_col, [
            spoiler_pos + ortho*16 + dir_vec*4, spoiler_pos - ortho*16 + dir_vec*4,
            spoiler_pos - ortho*16 - dir_vec*4, spoiler_pos + ortho*16 - dir_vec*4
        ])

    # ================= CAR 2: SPORT (ehem. Cyclone) =================
    elif car_type == 2:
        # Flach, breit, verkleidete Räder, futuristisch
        nose = pos + dir_vec * 24
        tail = pos - dir_vec * 22
        rear = tail
        
        # Breite Kotflügel hinten
        rf_l = pos - dir_vec * 10 + ortho * 14
        rf_r = pos - dir_vec * 10 - ortho * 14
        
        # Kotflügel vorne
        ff_l = pos + dir_vec * 12 + ortho * 13
        ff_r = pos + dir_vec * 12 - ortho * 13
        
        # Grundform (Kurvig)
        body_pts = [
            nose,
            ff_r,
            pos + ortho * 10, # Taille rechts
            rf_r,
            tail - ortho * 8,
            tail + ortho * 8,
            rf_l,
            pos - ortho * 10, # Taille links
            ff_l
        ]
        
        pygame.draw.polygon(surf, (0,0,0), [p + pygame.Vector2(4,4) for p in body_pts])
        pygame.draw.polygon(surf, body_col, body_pts)
        
        # Zwei markante Linien auf der Haube
        pygame.draw.line(surf, light_col, pos + dir_vec*5 + ortho*5, nose - ortho*2, 2)
        pygame.draw.line(surf, light_col, pos + dir_vec*5 - ortho*5, nose + ortho*2, 2)
        
        # Kabine (Sehr flach)
        cabin = [
            pos + dir_vec * 2 + ortho * 7,
            pos + dir_vec * 2 - ortho * 7,
            pos - dir_vec * 10 - ortho * 8,
            pos - dir_vec * 10 + ortho * 8
        ]
        pygame.draw.polygon(surf, CAR_WINDOW, cabin)

    # ================= CAR 3: MUSCLE (ehem. Dominus) =================
    elif car_type == 3:
        # Lang, kantig, flach
        nose = pos + dir_vec * 26
        tail = pos - dir_vec * 24
        rear = tail
        width_half = 11
        
        # Rechteckiger Body
        fl = nose + ortho * width_half
        fr = nose - ortho * width_half
        bl = tail + ortho * width_half
        br = tail - ortho * width_half
        
        body_pts = [fl, fr, br, bl]
        
        pygame.draw.polygon(surf, (0,0,0), [p + pygame.Vector2(4,4) for p in body_pts])
        pygame.draw.polygon(surf, body_col, body_pts)
        
        # Motorhaube (Lufthutze)
        scoop_pos = pos + dir_vec * 10
        pygame.draw.rect(surf, dark_col, (scoop_pos.x - 4, scoop_pos.y - 4, 8, 8))
        
        # Kabine (Kantig)
        cabin = [
            pos - dir_vec * 5 + ortho * 9,
            pos - dir_vec * 5 - ortho * 9,
            pos - dir_vec * 18 - ortho * 9,
            pos - dir_vec * 18 + ortho * 9
        ]
        pygame.draw.polygon(surf, CAR_WINDOW, cabin)
        pygame.draw.line(surf, light_col, fl, bl, 2) # Zierstreifen
        pygame.draw.line(surf, light_col, fr, br, 2)

    # ================= CAR 4: VAN (ehem. Merc) =================
    elif car_type == 4:
        # Groß, breit, bullig
        nose = pos + dir_vec * 18
        tail = pos - dir_vec * 22
        rear = tail
        w = 16
        
        body_pts = [
            nose + ortho * w, nose - ortho * w,
            tail - ortho * w, tail + ortho * w
        ]
        
        pygame.draw.polygon(surf, (0,0,0), [p + pygame.Vector2(5,5) for p in body_pts])
        pygame.draw.polygon(surf, body_col, body_pts)
        
        # Großes Dach
        roof = [
            nose - dir_vec * 5 + ortho * (w-2),
            nose - dir_vec * 5 - ortho * (w-2),
            tail + dir_vec * 2 - ortho * (w-2),
            tail + dir_vec * 2 + ortho * (w-2)
        ]
        pygame.draw.polygon(surf, dark_col, roof)
        
        # Reserverad hinten
        pygame.draw.circle(surf, (40,40,40), tail, 8)
        pygame.draw.circle(surf, (20,20,20), tail, 4)

    # ================= CAR 5: FORMULA (ehem. Animus) =================
    elif car_type == 5:
        # Sehr schmal, spitze Nase, breite Spoiler
        nose = pos + dir_vec * 30
        tail = pos - dir_vec * 20
        rear = tail
        
        # Body (Schmal)
        body_pts = [
            nose,
            pos + dir_vec * 10 - ortho * 5,
            tail - ortho * 6,
            tail + ortho * 6,
            pos + dir_vec * 10 + ortho * 5
        ]
        pygame.draw.polygon(surf, (0,0,0), [p + pygame.Vector2(4,4) for p in body_pts])
        pygame.draw.polygon(surf, body_col, body_pts)
        
        # Frontflügel
        fw_l = nose - dir_vec * 2 + ortho * 14
        fw_r = nose - dir_vec * 2 - ortho * 14
        pygame.draw.line(surf, light_col, fw_l, fw_r, 4)
        
        # Heckflügel
        rw_l = tail - dir_vec * 5 + ortho * 14
        rw_r = tail - dir_vec * 5 - ortho * 14
        pygame.draw.line(surf, dark_col, rw_l, rw_r, 6)
        
        # Cockpit
        pygame.draw.circle(surf, CAR_WINDOW, pos - dir_vec * 5, 5)


    # 5. Boost
    # Nur im Spiel anzeigen, nicht im Menü
    if state == "game" or boosting:
        origin = rear - dir_vec * 6
        flame_particles.append({
            "pos": origin.copy(),
            "vel": -dir_vec * random.uniform(1.5, 3),
            "life": random.randint(12, 22)
        })


def draw_flame():
    # Hellere Variante für den Kern der Flamme berechnen
    c_light = (
        min(255, int(selected_boost_color[0] * 1.4)),
        min(255, int(selected_boost_color[1] * 1.4)),
        min(255, int(selected_boost_color[2] * 1.4))
    )

    for p in flame_particles[:]:
        p["pos"] += p["vel"]
        p["life"] -= 1

        color = selected_boost_color if p["life"] > 8 else c_light
        pygame.draw.circle(screen, color,
                           (int(p["pos"].x), int(p["pos"].y)),
                           max(1, p["life"] // 3))

        if p["life"] <= 0:
            flame_particles.remove(p)


# ================= KOLLISION =================
def respawn_car():
    """Setzt nur das Auto zurück, nicht den Score"""
    global car_pos, velocity
    if "spawn" in MAPS[selected_map_index]:
        car_pos = MAPS[selected_map_index]["spawn"].copy()
    else:
        car_pos = pygame.Vector2(WIDTH // 2, HEIGHT // 2)
    velocity = 0

def start_game():
    """Startet eine neue Runde"""
    global score, collectible_pos, state, game_start_time
    respawn_car()
    score = 0
    collectible_pos = spawn_collectible()
    game_start_time = pygame.time.get_ticks()
    state = "game"

def handle_collisions():
    # Bei Kollision nur Auto zurücksetzen (Zeitstrafe durch Zeitverlust)
    # Score bleibt erhalten, damit man weiter sammeln kann.

    for o in obstacles:
        if car_pos.distance_to(o) < car_length / 2 + radius:
            respawn_car()

    if not border_rect.collidepoint(car_pos):
        respawn_car()

def handle_collect():
    global score, collectible_pos
    if car_pos.distance_to(collectible_pos) < car_length / 2 + collectible_radius:
        score += 1
        collectible_pos = spawn_collectible()


# ================= MENU =================
font_big = pygame.font.SysFont(None, 72)
font_small = pygame.font.SysFont(None, 36)
font_tiny = pygame.font.SysFont(None, 24)


def draw_menu():
    global btn_start, time_buttons, btn_select_car, btn_select_map, btn_background_settings

    draw_current_bg("menu")
    
    # Start Button
    btn_start.center = (WIDTH // 2, 150)
    pygame.draw.rect(screen, KHAKI, btn_start, border_radius=10)
    pygame.draw.rect(screen, WHITE, btn_start, 3, border_radius=10)
    
    start_txt = font_big.render("START", True, WHITE)
    screen.blit(start_txt, start_txt.get_rect(center=btn_start.center))

    # Zeit Auswahl Text
    info = font_small.render("Wähle deine Zeit:", True, BEIGE)
    screen.blit(info, info.get_rect(center=(WIDTH // 2, 250)))

    # Zeit Buttons generieren und zeichnen
    time_buttons = []
    start_x = 100
    gap = 90
    y_pos = 300
    
    # Zweizeilig falls nötig, hier passt es knapp in eine Reihe oder wir brechen um
    # Wir machen eine Reihe zentriert
    total_width = len(time_options) * 60 + (len(time_options)-1) * 20
    start_x = (WIDTH - total_width) // 2

    for i, t in enumerate(time_options):
        rect = pygame.Rect(start_x + i * 80, y_pos, 60, 40)
        time_buttons.append((rect, t))
        
        # Farbe: Gelb wenn ausgewählt, sonst Braun
        col = YELLOW if t == selected_time else DARK_BROWN
        txt_col = DARK_BROWN if t == selected_time else WHITE
        
        pygame.draw.rect(screen, col, rect, border_radius=5)
        lbl = font_small.render(f"{t}s" if t < 60 else "1m", True, txt_col)
        screen.blit(lbl, lbl.get_rect(center=rect.center))

    # Buttons zentriert nebeneinander
    center_x = WIDTH // 2
    btn_select_car.center = (center_x - 100, 420)
    btn_select_map.center = (center_x + 100, 420)

    pygame.draw.rect(screen, OBSTACLE_MID, btn_select_car, border_radius=10)
    car_txt = font_small.render("Car Settings", True, WHITE)
    screen.blit(car_txt, car_txt.get_rect(center=btn_select_car.center))

    pygame.draw.rect(screen, OBSTACLE_MID, btn_select_map, border_radius=10)
    map_txt = font_small.render("Map Settings", True, WHITE)
    screen.blit(map_txt, map_txt.get_rect(center=btn_select_map.center))

    btn_background_settings.center = (center_x, 490)
    pygame.draw.rect(screen, OBSTACLE_MID, btn_background_settings, border_radius=10)
    bg_txt = font_small.render("Background Settings", True, WHITE)
    screen.blit(bg_txt, bg_txt.get_rect(center=btn_background_settings.center))

    # Start hint
    start_hint = font_tiny.render("Press SHIFT to start", True, WHITE)
    start_hint = font_tiny.render("Press SPACE to start", True, WHITE)
    screen.blit(start_hint, start_hint.get_rect(topright=(WIDTH - 20, 60)))

def draw_car_select():
    global btn_back, car_select_rects, selected_car, btn_car_color_select, btn_boost_color_select
    
    draw_current_bg("garage")
    
    # Titel
    title = font_big.render("Choose your Ride", True, WHITE)
    screen.blit(title, title.get_rect(center=(WIDTH // 2, 80)))

    # --- Car Display Grid/Arc ---
    car_select_rects = []
    
    # Temporär das ausgewählte Auto ändern, um alle zu zeichnen
    original_selection_id = selected_car

    for i, model in enumerate(CAR_MODELS):
        # Position in a shallow V-shape
        x_pos = (WIDTH // 2) + (i - 2) * 150
        y_pos = (HEIGHT // 2 - 20) + abs(i - 2) * 40
        
        rect = pygame.Rect(0, 0, 140, 140)
        rect.center = (x_pos, y_pos)
        car_select_rects.append((rect, i))
        
        # Plattform unter dem Auto
        platform_color = (50, 50, 55) if model["id"] == original_selection_id else (30, 30, 35)
        pygame.draw.ellipse(screen, platform_color, rect.inflate(10, 0))
        
        # Rahmen für Auswahl
        if model["id"] == original_selection_id:
            pygame.draw.ellipse(screen, YELLOW, rect.inflate(10, 0), 3)
        
        # Auto zeichnen (nach oben gerichtet)
        selected_car = model["id"]
        draw_car(pygame.Vector2(x_pos, y_pos), -90)
        
        # Name des Autos unter der Plattform
        name_surf = font_tiny.render(model["name"], True, WHITE)
        screen.blit(name_surf, name_surf.get_rect(center=(x_pos, y_pos + 90)))

    # Auswahl wiederherstellen
    selected_car = original_selection_id

    # --- Customization Buttons ---
    btn_y = HEIGHT - 100
    btn_car_color_select.center = (WIDTH // 2 - 120, btn_y)
    btn_boost_color_select.center = (WIDTH // 2 + 120, btn_y)
    pygame.draw.rect(screen, OBSTACLE_MID, btn_car_color_select, border_radius=8)
    cc_txt = font_small.render("Car Colour", True, WHITE)
    screen.blit(cc_txt, cc_txt.get_rect(center=btn_car_color_select.center))
    pygame.draw.rect(screen, OBSTACLE_MID, btn_boost_color_select, border_radius=8)
    bc_txt = font_small.render("Boost Colour", True, WHITE)
    screen.blit(bc_txt, bc_txt.get_rect(center=btn_boost_color_select.center))

    # Back Button
    btn_back = pygame.Rect(WIDTH - 120, 20, 100, 40)
    pygame.draw.rect(screen, RELAXED_RED, btn_back, border_radius=8)
    back_txt = font_small.render("Back", True, WHITE)
    screen.blit(back_txt, back_txt.get_rect(center=btn_back.center))

def draw_color_select():
    global color_choice_rects
    draw_current_bg("garage")
    
    # Back Button oben rechts
    btn_back_top = pygame.Rect(WIDTH - 120, 20, 100, 40)
    pygame.draw.rect(screen, RELAXED_RED, btn_back_top, border_radius=8)
    b_txt = font_small.render("Back", True, WHITE)
    screen.blit(b_txt, b_txt.get_rect(center=btn_back_top.center))
    
    # Titel
    title = font_big.render("Wähle eine Farbe", True, WHITE)
    screen.blit(title, title.get_rect(center=(WIDTH // 2, 60)))
    
    # Auto groß anzeigen
    draw_car(pygame.Vector2(WIDTH // 2, 180), -90)
    
    # Farben Grid
    color_choice_rects = []
    cols = 12
    box_size = 32
    gap = 5
    
    total_w = cols * box_size + (cols - 1) * gap
    start_x = (WIDTH - total_w) // 2
    start_y = 300
    
    for i, col in enumerate(FULL_PALETTE):
        row = i // cols
        col_idx = i % cols
        x = start_x + col_idx * (box_size + gap)
        y = start_y + row * (box_size + gap)
        
        rect = pygame.Rect(x, y, box_size, box_size)
        color_choice_rects.append((rect, col))
        
        pygame.draw.rect(screen, col, rect, border_radius=4)
        if col == selected_color:
            pygame.draw.rect(screen, WHITE, rect.inflate(4,4), 2, border_radius=4)
            
    return btn_back_top

def draw_boost_color_select():
    global color_choice_rects
    draw_current_bg("garage")
    
    # Back Button
    btn_back_top = pygame.Rect(WIDTH - 120, 20, 100, 40)
    pygame.draw.rect(screen, RELAXED_RED, btn_back_top, border_radius=8)
    b_txt = font_small.render("Back", True, WHITE)
    screen.blit(b_txt, b_txt.get_rect(center=btn_back_top.center))
    
    # Titel
    title = font_big.render("Wähle Boost Farbe", True, WHITE)
    screen.blit(title, title.get_rect(center=(WIDTH // 2, 60)))
    
    # Flammen zeichnen (Hinter dem Auto oder davor, hier davor damit man sie sieht)
    draw_flame()

    # Auto boostend anzeigen
    draw_car(pygame.Vector2(WIDTH // 2, 180), -90, boosting=True)
    
    # Farben Grid
    color_choice_rects = []
    cols = 12
    box_size = 32
    gap = 5
    
    total_w = cols * box_size + (cols - 1) * gap
    start_x = (WIDTH - total_w) // 2
    start_y = 300
    
    for i, col in enumerate(FULL_PALETTE):
        row = i // cols
        col_idx = i % cols
        x = start_x + col_idx * (box_size + gap)
        y = start_y + row * (box_size + gap)
        rect = pygame.Rect(x, y, box_size, box_size)
        color_choice_rects.append((rect, col))
        
        pygame.draw.rect(screen, col, rect, border_radius=4)
        if col == selected_boost_color:
            pygame.draw.rect(screen, WHITE, rect.inflate(4,4), 2, border_radius=4)
            
    return btn_back_top

def draw_map_settings():
    global btn_back, map_nav_buttons, theme_nav_buttons, btn_obstacle_settings
    draw_current_bg("map")

    # Titel
    title = font_big.render("Map Selection", True, WHITE)
    screen.blit(title, title.get_rect(center=(WIDTH // 2, 50)))

    # Full Map Preview (Scaled)
    preview_surf = pygame.Surface((WIDTH, HEIGHT))
    draw_background(preview_surf)
    draw_obstacles(preview_surf)
    
    scale_w, scale_h = 400, 300
    scaled_preview = pygame.transform.smoothscale(preview_surf, (scale_w, scale_h))
    
    preview_rect = pygame.Rect(0, 0, scale_w, scale_h)
    preview_rect.center = (WIDTH // 2, 240)
    
    # Rahmen um Preview
    pygame.draw.rect(screen, WHITE, preview_rect.inflate(4, 4), 2)
    screen.blit(scaled_preview, preview_rect)

    # Map Name & Navigation
    ctrl_y = 430
    map_name = MAPS[selected_map_index]["name"]
    name_surf = font_small.render(map_name, True, YELLOW)
    screen.blit(name_surf, name_surf.get_rect(center=(WIDTH // 2, ctrl_y)))

    btn_prev = pygame.Rect(WIDTH // 2 - 180, ctrl_y - 20, 40, 40)
    btn_next = pygame.Rect(WIDTH // 2 + 140, ctrl_y - 20, 40, 40)
    map_nav_buttons = [(btn_prev, -1), (btn_next, 1)]

    pygame.draw.rect(screen, OBSTACLE_MID, btn_prev, border_radius=5)
    pygame.draw.rect(screen, OBSTACLE_MID, btn_next, border_radius=5)
    screen.blit(font_small.render("<", True, WHITE), (btn_prev.x + 12, btn_prev.y + 8))
    screen.blit(font_small.render(">", True, WHITE), (btn_next.x + 12, btn_next.y + 8))

    # Theme Selection
    theme_y = 480
    theme_lbl = font_tiny.render("Theme:", True, BEIGE)
    screen.blit(theme_lbl, (WIDTH // 2 - 200, theme_y + 10))

    theme_name = THEMES[selected_theme_index]["name"]
    t_surf = font_small.render(theme_name, True, WHITE)
    screen.blit(t_surf, t_surf.get_rect(center=(WIDTH // 2, theme_y + 20)))

    btn_t_prev = pygame.Rect(WIDTH // 2 - 120, theme_y, 40, 40)
    btn_t_next = pygame.Rect(WIDTH // 2 + 80, theme_y, 40, 40)
    theme_nav_buttons = [(btn_t_prev, -1), (btn_t_next, 1)]
    pygame.draw.rect(screen, (60, 60, 70), btn_t_prev, border_radius=5)
    pygame.draw.rect(screen, (60, 60, 70), btn_t_next, border_radius=5)
    screen.blit(font_small.render("<", True, WHITE), (btn_t_prev.x + 12, btn_t_prev.y + 8))
    screen.blit(font_small.render(">", True, WHITE), (btn_t_next.x + 12, btn_t_next.y + 8))

    # Button to Obstacle Settings
    btn_obstacle_settings = pygame.Rect(0, 0, 220, 50)
    btn_obstacle_settings.center = (WIDTH // 2, 550)
    pygame.draw.rect(screen, OBSTACLE_MID, btn_obstacle_settings, border_radius=10)
    obs_txt = font_small.render("Obstacle Style", True, WHITE)
    screen.blit(obs_txt, obs_txt.get_rect(center=btn_obstacle_settings.center))

    # Back Button
    btn_back = pygame.Rect(WIDTH - 120, 20, 100, 40)
    pygame.draw.rect(screen, RELAXED_RED, btn_back, border_radius=8)
    back_txt = font_small.render("Back", True, WHITE)
    screen.blit(back_txt, back_txt.get_rect(center=btn_back.center))

def draw_obstacle_settings():
    global btn_back, shape_buttons, color_choice_rects
    draw_current_bg("map")

    title = font_big.render("Obstacle Settings", True, WHITE)
    screen.blit(title, title.get_rect(center=(WIDTH // 2, 50)))

    # Preview Box (Einzelnes Hindernis)
    preview_rect = pygame.Rect(0, 0, 300, 140)
    preview_rect.center = (WIDTH // 2, 140)
    pygame.draw.rect(screen, THEMES[selected_theme_index]["bg"], preview_rect)
    pygame.draw.rect(screen, WHITE, preview_rect, 2)
    
    # Sample Obstacle zeichnen
    center_pos = pygame.Vector2(preview_rect.centerx, preview_rect.centery)
    draw_single_obstacle(screen, center_pos, obstacle_shape, obstacle_color, THEMES[selected_theme_index]["bg"])

    # Shape Selection
    shape_y = 240
    lbl = font_small.render("Shape:", True, BEIGE)
    screen.blit(lbl, (WIDTH // 2 - 250, shape_y + 10))
    
    shapes = ["circle", "square", "triangle"]
    shape_buttons = []
    start_x = WIDTH // 2 - 100
    for i, sh in enumerate(shapes):
        rect = pygame.Rect(start_x + i * 100, shape_y, 80, 40)
        shape_buttons.append((rect, sh))
        col = YELLOW if sh == obstacle_shape else (60, 60, 70)
        pygame.draw.rect(screen, col, rect, border_radius=5)
        txt = font_tiny.render(sh.capitalize(), True, DARK_BROWN if sh == obstacle_shape else WHITE)
        screen.blit(txt, txt.get_rect(center=rect.center))

    # Color Selection
    col_y = 300
    lbl_c = font_small.render("Color:", True, BEIGE)
    screen.blit(lbl_c, (WIDTH // 2 - 250, col_y + 10))
    
    color_choice_rects = []
    cols = 12
    box_size = 32
    gap = 5
    
    total_w = cols * box_size + (cols - 1) * gap
    start_x = (WIDTH - total_w) // 2
    start_y = col_y
    
    for i, col in enumerate(FULL_PALETTE):
        row = i // cols
        col_idx = i % cols
        x = start_x + col_idx * (box_size + gap)
        y = start_y + row * (box_size + gap)
        
        rect = pygame.Rect(x, y, box_size, box_size)
        color_choice_rects.append((rect, col))
        
        pygame.draw.rect(screen, col, rect, border_radius=4)
        if col == obstacle_color:
            pygame.draw.rect(screen, WHITE, rect.inflate(4,4), 2, border_radius=4)

    # Back Button
    btn_back = pygame.Rect(WIDTH - 120, 20, 100, 40)
    pygame.draw.rect(screen, RELAXED_RED, btn_back, border_radius=8)
    back_txt = font_small.render("Back", True, WHITE)
    screen.blit(back_txt, back_txt.get_rect(center=btn_back.center))

def draw_background_categories():
    global btn_back, bg_category_rects
    draw_current_bg("menu")
    title = font_big.render("Background Settings", True, WHITE)
    screen.blit(title, title.get_rect(center=(WIDTH // 2, 80)))
    
    bg_category_rects = []
    cats = ["menu", "garage", "map", "score"]
    start_y = 180
    for i, key in enumerate(cats):
        rect = pygame.Rect(0, 0, 300, 60)
        rect.center = (WIDTH // 2, start_y + i * 80)
        bg_category_rects.append((rect, key))
        
        pygame.draw.rect(screen, OBSTACLE_MID, rect, border_radius=10)
        txt = font_small.render(BG_CATEGORIES[key]["name"], True, WHITE)
        screen.blit(txt, txt.get_rect(center=rect.center))

    btn_back = pygame.Rect(WIDTH - 120, 20, 100, 40)
    pygame.draw.rect(screen, RELAXED_RED, btn_back, border_radius=8)
    back_txt = font_small.render("Back", True, WHITE)
    screen.blit(back_txt, back_txt.get_rect(center=btn_back.center))

def draw_background_select_specific():
    global btn_back, bg_option_rects
    draw_current_bg(current_bg_category)
    
    cat_name = BG_CATEGORIES[current_bg_category]["name"]
    title = font_big.render(f"{cat_name} Style", True, WHITE)
    screen.blit(title, title.get_rect(center=(WIDTH // 2, 80)))
    
    bg_option_rects = []
    options = BG_CATEGORIES[current_bg_category]["options"]
    selected_idx = BG_CATEGORIES[current_bg_category]["selected"]
    
    preview_w, preview_h = 180, 130
    gap = 25
    num_cols = 3
    start_x = (WIDTH - (num_cols * preview_w + (num_cols - 1) * gap)) // 2
    
    for i, bg in enumerate(options):
        row = i // num_cols
        col_idx = i % num_cols
        x = start_x + col_idx * (preview_w + gap)
        y = 180 + row * (preview_h + gap + 30)
        rect = pygame.Rect(x, y, preview_w, preview_h)
        bg_option_rects.append((rect, i))
        
        temp_surf = pygame.Surface((WIDTH, HEIGHT))
        bg["func"](temp_surf)
        scaled_preview = pygame.transform.smoothscale(temp_surf, (preview_w, preview_h))
        screen.blit(scaled_preview, rect)
        
        if i == selected_idx:
            pygame.draw.rect(screen, YELLOW, rect, 3, border_radius=5)
        else:
            pygame.draw.rect(screen, WHITE, rect, 1, border_radius=5)
            
        name_surf = font_tiny.render(bg["name"], True, WHITE)
        screen.blit(name_surf, name_surf.get_rect(center=(rect.centerx, rect.bottom + 15)))
        
    btn_back = pygame.Rect(WIDTH - 120, 20, 100, 40)
    pygame.draw.rect(screen, RELAXED_RED, btn_back, border_radius=8)
    back_txt = font_small.render("Back", True, WHITE)
    screen.blit(back_txt, back_txt.get_rect(center=btn_back.center))

def draw_scoreboard():
    draw_current_bg("score")

    # Titel
    head = font_big.render("Ergebnisse", True, WHITE)
    screen.blit(head, head.get_rect(center=(WIDTH // 2, 60)))

    # Tabelle Header
    pygame.draw.line(screen, BEIGE, (200, 110), (600, 110), 2)
    h1 = font_small.render("Punkte", True, KHAKI)
    h2 = font_small.render("Zeit-Modus", True, KHAKI)
    screen.blit(h1, (250, 120))
    screen.blit(h2, (450, 120))

    # Liste (letzte 10)
    # Wir zeigen die Liste invertiert (neueste oben) oder so wie sie ist.
    # Aufgabenstellung: "letzten 10 aufgelisteten"
    for i, entry in enumerate(reversed(score_history)):
        if i >= 10: break
        y = 160 + i * 30
        s_txt = font_small.render(str(entry['score']), True, WHITE)
        t_txt = font_small.render(f"{entry['time']} sec", True, WHITE)
        screen.blit(s_txt, (250, y))
        screen.blit(t_txt, (450, y))

    # Buttons unten
    btn_replay = pygame.Rect(50, HEIGHT - 80, 200, 50)
    btn_change = pygame.Rect(WIDTH - 250, HEIGHT - 80, 200, 50)

    # Replay (Links)
    pygame.draw.rect(screen, OBSTACLE_MID, btn_replay, border_radius=8)
    rep_txt = font_small.render("Replay", True, WHITE)
    screen.blit(rep_txt, rep_txt.get_rect(center=btn_replay.center))

    # Home (Rechts)
    pygame.draw.rect(screen, OBSTACLE_MID, btn_change, border_radius=8)
    chg_txt = font_small.render("Home", True, WHITE)
    screen.blit(chg_txt, chg_txt.get_rect(center=btn_change.center))
    
    return btn_replay, btn_change

# ================= LOOP =================
running = True
while running:
    clock.tick(FPS)

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

        if event.type == pygame.KEYDOWN:
            if state == "menu" and event.key == pygame.K_SPACE:
                start_game()
            elif state == "game" and event.key == pygame.K_RETURN:
                state = "menu"

        if event.type == pygame.MOUSEBUTTONDOWN:
            mx, my = pygame.mouse.get_pos()
            
            if state == "menu":
                # Start Button
                if btn_start.collidepoint(mx, my):
                    start_game()
                
                # Zeit Auswahl
                for rect, t in time_buttons:
                    if rect.collidepoint(mx, my):
                        selected_time = t
                
                # Auto Auswahl
                if btn_select_car.collidepoint(mx, my):
                    state = "car_select"

                # Map Auswahl
                if btn_select_map.collidepoint(mx, my):
                    state = "map_settings"
            
                if btn_background_settings.collidepoint(mx, my):
                    state = "background_categories"

            elif state == "scoreboard":
                # Buttons werden in draw_scoreboard definiert, wir berechnen sie hier analog
                btn_replay = pygame.Rect(50, HEIGHT - 80, 200, 50)
                btn_change = pygame.Rect(WIDTH - 250, HEIGHT - 80, 200, 50)
                
                if btn_replay.collidepoint(mx, my):
                    start_game()
                elif btn_change.collidepoint(mx, my):
                    state = "menu"
            
            elif state == "car_select":
                # Auto wählen
                for rect, index in car_select_rects:
                    if rect.collidepoint(mx, my):
                        selected_car_index = index
                        selected_car = CAR_MODELS[index]["id"]
                
                # Zurück
                if btn_back.collidepoint(mx, my):
                    state = "menu"
                
                # Car Colour Button
                if btn_car_color_select.collidepoint(mx, my):
                    state = "color_select"

                # Boost Colour Button
                if btn_boost_color_select.collidepoint(mx, my):
                    state = "boost_color_select"
            
            elif state == "color_select":
                # Back Button (wird in draw_color_select zurückgegeben oder wir berechnen ihn)
                btn_back_top = pygame.Rect(WIDTH - 120, 20, 100, 40)
                if btn_back_top.collidepoint(mx, my):
                    state = "car_select"
                
                # Farbe auswählen
                for rect, col in color_choice_rects:
                    if rect.collidepoint(mx, my):
                        selected_color = col
            
            elif state == "boost_color_select":
                # Back Button
                btn_back_top = pygame.Rect(WIDTH - 120, 20, 100, 40)
                if btn_back_top.collidepoint(mx, my):
                    state = "car_select"
                
                for rect, col in color_choice_rects:
                    if rect.collidepoint(mx, my):
                        selected_boost_color = col
            
            elif state == "background_categories":
                if btn_back.collidepoint(mx, my):
                    state = "menu"
                for rect, key in bg_category_rects:
                    if rect.collidepoint(mx, my):
                        current_bg_category = key
                        state = "background_select_specific"

            elif state == "background_select_specific":
                if btn_back.collidepoint(mx, my):
                    state = "background_categories"
                for rect, idx in bg_option_rects:
                    if rect.collidepoint(mx, my):
                        BG_CATEGORIES[current_bg_category]["selected"] = idx

            
            elif state == "map_settings":
                # Back
                if btn_back.collidepoint(mx, my):
                    state = "menu"
                
                # Map Navigation
                for rect, direction in map_nav_buttons:
                    if rect.collidepoint(mx, my):
                        selected_map_index = (selected_map_index + direction) % len(MAPS)
                        obstacles = MAPS[selected_map_index]["pos"]
                        collectible_pos = spawn_collectible() # Respawn collectible to avoid overlap

                # Theme Navigation
                for rect, direction in theme_nav_buttons:
                    if rect.collidepoint(mx, my):
                        selected_theme_index = (selected_theme_index + direction) % len(THEMES)
                
                # Go to Obstacle Settings
                if btn_obstacle_settings.collidepoint(mx, my):
                    state = "obstacle_settings"

            elif state == "obstacle_settings":
                # Back
                if btn_back.collidepoint(mx, my):
                    state = "map_settings"
                
                # Shape
                for rect, sh in shape_buttons:
                    if rect.collidepoint(mx, my):
                        obstacle_shape = sh
                
                # Color
                for rect, col in color_choice_rects:
                    if rect.collidepoint(mx, my):
                        obstacle_color = col

    if state == "menu":
        draw_menu()
        pygame.display.flip()
        continue

    if state == "car_select":
        draw_car_select()
        pygame.display.flip()
        continue

    if state == "color_select":
        draw_color_select()
        pygame.display.flip()
        continue

    if state == "boost_color_select":
        draw_boost_color_select()
        pygame.display.flip()
        continue

    if state == "background_categories":
        draw_background_categories()
        pygame.display.flip()
        continue

    if state == "background_select_specific":
        draw_background_select_specific()
        pygame.display.flip()
        continue

    if state == "map_settings":
        draw_map_settings()
        pygame.display.flip()
        continue

    if state == "obstacle_settings":
        draw_obstacle_settings()
        pygame.display.flip()
        continue

    if state == "scoreboard":
        draw_scoreboard()
        pygame.display.flip()
        continue

    # Game Logic Timer Check
    elapsed_time = (pygame.time.get_ticks() - game_start_time) / 1000
    if elapsed_time >= selected_time:
        score_history.append({'score': score, 'time': selected_time})
        state = "scoreboard"
        continue

    keys = pygame.key.get_pressed()

    if keys[pygame.K_UP]:
        velocity = min(max_speed, velocity + acceleration)
    elif keys[pygame.K_DOWN]:
        velocity = max(-max_speed / 2, velocity - acceleration)
    else:
        if velocity > 0:
            velocity = max(0, velocity - STOP_FRICTION)
        elif velocity < 0:
            velocity = min(0, velocity + STOP_FRICTION)

    # Lenkung (Mittelweg im Stand)
    current_turn = turn_speed * 1.1 if abs(velocity) < 2.0 else turn_speed
    if keys[pygame.K_LEFT]:
        car_angle -= current_turn
    if keys[pygame.K_RIGHT]:
        car_angle += current_turn

    rad = math.radians(car_angle)
    dir_vec = pygame.Vector2(math.cos(rad), math.sin(rad))
    car_pos += dir_vec * velocity

    if velocity != 0:
        ortho = pygame.Vector2(-dir_vec.y, dir_vec.x)
        car_pos += ortho * (1 - drift_factor) * 0.02

    handle_collisions()
    handle_collect()

    draw_background()
    draw_obstacles()
    draw_collectible()
    draw_score()
    draw_flame()
    draw_car(car_pos, car_angle)

    pygame.display.flip()

pygame.quit()
sys.exit()