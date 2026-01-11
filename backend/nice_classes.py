"""
Nice class mapping for trademark classifications.
"""

NICE_CLASS_MAP = {
    "1": "Chemicals",
    "2": "Paints, varnishes & coatings",
    "3": "Cosmetics & cleaning preparations",
    "4": "Industrial oils, greases & fuels",
    "5": "Pharmaceuticals & medical preparations",
    "6": "Common metals & metal goods",
    "7": "Machines & machine tools",
    "8": "Hand tools",
    "9": "Scientific & electronic apparatus, software",
    "10": "Medical apparatus",
    "11": "Lighting, heating & cooling",
    "12": "Vehicles",
    "13": "Firearms",
    "14": "Jewellery, clocks & watches",
    "15": "Musical instruments",
    "16": "Paper goods & printed matter",
    "17": "Rubber, plastics & insulation materials",
    "18": "Leather goods & bags",
    "19": "Building materials",
    "20": "Furniture",
    "21": "Household utensils & glassware",
    "22": "Ropes, nets & sacks",
    "23": "Yarns & threads",
    "24": "Textiles & textile goods",
    "25": "Clothing, footwear & headgear",
    "26": "Lace, buttons & haberdashery",
    "27": "Floor coverings",
    "28": "Games, toys & sporting goods",
    "29": "Meat, fish & processed foods",
    "30": "Coffee, tea, flour & bakery goods",
    "31": "Agriculture & fresh foods",
    "32": "Beers & non-alcoholic beverages",
    "33": "Alcoholic beverages",
    "34": "Tobacco & smokers' articles",
    "35": "Advertising, business & retail services",
    "36": "Financial, insurance & real estate services",
    "37": "Construction & repair services",
    "38": "Telecommunications",
    "39": "Transport, packaging & travel services",
    "40": "Material treatment",
    "41": "Education, entertainment & sporting services",
    "42": "Scientific & technology services; software",
    "43": "Food, drink & accommodation services",
    "44": "Medical, beauty & agriculture services",
    "45": "Legal & security services",
}


def label_nice_class(n: str) -> str:
    """Label a Nice class number with its description."""
    key = n.strip()
    if key in NICE_CLASS_MAP:
        return f"{key} ({NICE_CLASS_MAP[key]})"
    return key
