import csv
import io
import random
import string
import unicodedata
from datetime import datetime, timedelta
from typing import Dict, List, Optional


def generate_id(length: int = 9) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


def generate_rating() -> int:
    """Realistic star distribution: 70% five stars, 20% four, 10% three."""
    return random.choices([5, 4, 3], weights=[70, 20, 10])[0]


def generate_random_date(days_ago_max: int = 90) -> str:
    days_ago = random.randint(1, days_ago_max)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    seconds = random.randint(0, 59)
    ms = random.randint(0, 999)
    date = datetime.now() - timedelta(
        days=days_ago, hours=hours, minutes=minutes, seconds=seconds
    )
    return date.strftime(f"%Y-%m-%dT%H:%M:%S.{ms:03d}Z")


def generate_reply_date(review_date_str: str) -> str:
    try:
        review_date = datetime.strptime(review_date_str[:19], "%Y-%m-%dT%H:%M:%S")
        reply_delay_hours = random.randint(2, 18)
        reply_date = review_date + timedelta(hours=reply_delay_hours)
        ms = random.randint(0, 999)
        return reply_date.strftime(f"%Y-%m-%dT%H:%M:%S.{ms:03d}Z")
    except Exception:
        return generate_random_date(89)


def normalize_for_email(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn")


def generate_fake_email(author: str) -> str:
    parts = author.split(" ")
    first_name = parts[0].lower() if parts else "client"
    first_name = normalize_for_email(first_name)
    first_name = "".join(c for c in first_name if c.isalnum())

    domains = [
        "gmail.com",
        "hotmail.fr",
        "yahoo.fr",
        "outlook.fr",
        "orange.fr",
        "free.fr",
        "sfr.fr",
        "laposte.net",
        "wanadoo.fr",
    ]
    domain = random.choice(domains)
    suffix = random.randint(10, 999)
    return f"{first_name}{suffix}@{domain}"


def _pick_image(
    review_data: Dict,
    i: int,
    image_urls: List[str],
    female_image_urls: Optional[List[str]],
    male_image_urls: Optional[List[str]],
    gender_counters: Dict[str, int],
) -> str:
    """Pick the right image URL based on review gender if gendered pools are provided."""
    if female_image_urls is not None and male_image_urls is not None:
        gender = review_data.get("gender", "")
        if gender == "F" and female_image_urls:
            idx = gender_counters["F"] % len(female_image_urls)
            gender_counters["F"] += 1
            return female_image_urls[idx]
        elif gender == "M" and male_image_urls:
            idx = gender_counters["M"] % len(male_image_urls)
            gender_counters["M"] += 1
            return male_image_urls[idx]
        return ""
    return image_urls[i] if i < len(image_urls) else ""


def generate_loox_full_csv(
    reviews: List[Dict],
    product_handle: str,
    image_urls: List[str],
    female_image_urls: Optional[List[str]] = None,
    male_image_urls: Optional[List[str]] = None,
) -> str:
    """
    Generate full Loox export-format CSV (18 columns, includes replies).
    Based on Reviews.Exporter.csv structure.
    """
    headers = [
        "id",
        "status",
        "rating",
        "email",
        "img",
        "nickname",
        "full_name",
        "review",
        "date",
        "productId",
        "handle",
        "variant",
        "verified_purchase",
        "orderId",
        "reply",
        "replied_at",
        "metaobject_handle",
        "incentivized",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, quoting=csv.QUOTE_ALL)
    writer.writeheader()

    gender_counters: Dict[str, int] = {"F": 0, "M": 0}

    for i, review_data in enumerate(reviews):
        review_id = generate_id()
        review_date = generate_random_date(90)
        reply_text = review_data.get("reply", "")
        reply_date = generate_reply_date(review_date) if reply_text else ""

        img_url = _pick_image(review_data, i, image_urls, female_image_urls, male_image_urls, gender_counters)
        author = review_data.get("author", "Client")
        email = generate_fake_email(author)

        row = {
            "id": review_id,
            "status": "Active",
            "rating": generate_rating(),
            "email": email,
            "img": img_url,
            "nickname": author,
            "full_name": author,
            "review": review_data.get("review", ""),
            "date": review_date,
            "productId": "",
            "handle": product_handle,
            "variant": "",
            "verified_purchase": "",
            "orderId": "",
            "reply": reply_text,
            "replied_at": reply_date,
            "metaobject_handle": "",
            "incentivized": "",
        }
        writer.writerow(row)

    return output.getvalue()


def generate_loox_full_csv_multi(products: List[Dict]) -> str:
    """
    Generate combined full CSV for multiple products.
    products: [{"reviews": List[Dict], "product_handle": str, "image_urls": List[str],
                "female_image_urls": Optional[List[str]], "male_image_urls": Optional[List[str]]}]
    """
    headers = [
        "id", "status", "rating", "email", "img", "nickname", "full_name",
        "review", "date", "productId", "handle", "variant", "verified_purchase",
        "orderId", "reply", "replied_at", "metaobject_handle", "incentivized",
    ]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, quoting=csv.QUOTE_ALL)
    writer.writeheader()

    for product in products:
        reviews = product["reviews"]
        product_handle = product["product_handle"]
        image_urls = product.get("image_urls", [])
        female_urls = product.get("female_image_urls") or None
        male_urls = product.get("male_image_urls") or None
        gender_counters: Dict[str, int] = {"F": 0, "M": 0}
        for i, review_data in enumerate(reviews):
            review_id = generate_id()
            review_date = generate_random_date(90)
            reply_text = review_data.get("reply", "")
            reply_date = generate_reply_date(review_date) if reply_text else ""
            img_url = _pick_image(review_data, i, image_urls, female_urls, male_urls, gender_counters)
            author = review_data.get("author", "Client")
            email = generate_fake_email(author)
            writer.writerow({
                "id": review_id, "status": "Active", "rating": generate_rating(),
                "email": email, "img": img_url, "nickname": author,
                "full_name": author, "review": review_data.get("review", ""),
                "date": review_date, "productId": "", "handle": product_handle,
                "variant": "", "verified_purchase": "", "orderId": "",
                "reply": reply_text, "replied_at": reply_date,
                "metaobject_handle": "", "incentivized": "",
            })

    return output.getvalue()


def generate_loox_import_csv_multi(products: List[Dict]) -> str:
    """
    Generate combined simple import CSV for multiple products.
    products: [{"reviews": List[Dict], "product_handle": str, "image_urls": List[str],
                "female_image_urls": Optional[List[str]], "male_image_urls": Optional[List[str]]}]
    """
    headers = [
        "product_handle", "rating", "author", "email", "body",
        "created_at", "photo_url", "verified_purchase",
    ]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, quoting=csv.QUOTE_ALL)
    writer.writeheader()

    for product in products:
        reviews = product["reviews"]
        product_handle = product["product_handle"]
        image_urls = product.get("image_urls", [])
        female_urls = product.get("female_image_urls") or None
        male_urls = product.get("male_image_urls") or None
        gender_counters: Dict[str, int] = {"F": 0, "M": 0}
        for i, review_data in enumerate(reviews):
            review_date = generate_random_date(90)
            img_url = _pick_image(review_data, i, image_urls, female_urls, male_urls, gender_counters)
            author = review_data.get("author", "Client")
            email = generate_fake_email(author)
            writer.writerow({
                "product_handle": product_handle, "rating": generate_rating(),
                "author": author, "email": email,
                "body": review_data.get("review", ""),
                "created_at": review_date, "photo_url": img_url,
                "verified_purchase": "TRUE",
            })

    return output.getvalue()


def generate_loox_import_csv(
    reviews: List[Dict],
    product_handle: str,
    image_urls: List[str],
    female_image_urls: Optional[List[str]] = None,
    male_image_urls: Optional[List[str]] = None,
) -> str:
    """
    Generate simple Loox import-format CSV (8 columns).
    Based on Review Import Template.csv structure.
    """
    headers = [
        "product_handle",
        "rating",
        "author",
        "email",
        "body",
        "created_at",
        "photo_url",
        "verified_purchase",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, quoting=csv.QUOTE_ALL)
    writer.writeheader()

    gender_counters: Dict[str, int] = {"F": 0, "M": 0}

    for i, review_data in enumerate(reviews):
        review_date = generate_random_date(90)
        img_url = _pick_image(review_data, i, image_urls, female_image_urls, male_image_urls, gender_counters)
        author = review_data.get("author", "Client")
        email = generate_fake_email(author)

        row = {
            "product_handle": product_handle,
            "rating": generate_rating(),
            "author": author,
            "email": email,
            "body": review_data.get("review", ""),
            "created_at": review_date,
            "photo_url": img_url,
            "verified_purchase": "TRUE",
        }
        writer.writerow(row)

    return output.getvalue()
