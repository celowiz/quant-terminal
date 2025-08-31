import os
import pandas as pd
import requests
from dotenv import load_dotenv
from pathlib import Path

# Caminho para o .env na raiz do projeto
env_path = Path.cwd().parents[0] / ".env"
load_dotenv(dotenv_path=env_path)

# Setup
FRED_API_KEY  = os.getenv("FRED_API_KEY")
BASE_URL = "https://api.stlouisfed.org/fred"
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# Lista de séries que você quer baixar
series_ids = {
    "GDP": "Gross Domestic Product",
    "UNRATE": "Unemployment Rate",
    "CPIAUCSL": "Consumer Price Index",
    'INDPRO': 'Industrial Production',
    'CPILFESL': 'CPI Core Index'
}

# ---------- Category ----------

# fred/category
def get_series_info(category_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/category.html
    Description: Get a category.
    Input: The id for a category.
    """
    url = f"{BASE_URL}/category?category_id={category_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["categories"][0]

# fred/category/children
def get_series_info(category_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/category_children.html
    Description: Get the child categories for a specified parent category.
    Input: The id for a category.
    """
    url = f"{BASE_URL}/category/related?category_id={category_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["categories"][0]

# fred/category/related
def get_series_info(category_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/category_related.html
    Description: Get the related categories for a category. A related category is a one-way relation between 2 categories that is not part of a parent-child category hierarchy. Most categories do not have related categories.
    Input: The id for a category.
    """
    url = f"{BASE_URL}/category/children?category_id={category_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["categories"][0]

# fred/category/series
def get_series_info(category_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/category_series.html
    Description: Get the series in a category
    Input: The id for a category.
    """
    url = f"{BASE_URL}/category/series?category_id={category_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# fred/category/tags
def get_series_info(category_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/category_tags.html
    Description: Get the FRED tags for a category. Optionally, filter results by tag name, tag group, or search. Series are assigned tags and categories. Indirectly through series, it is possible to get the tags for a category. No tags exist for a category that does not have series.
    Input: The id for a category.
    """
    url = f"{BASE_URL}/category/tags?category_id={category_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# fred/category/related_tags
def get_series_info(category_id, tag_names):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/category_related_tags.html
    Description: Get the related FRED tags for one or more FRED tags within a category.
    Input: The id for a category and A semicolon delimited list of tag names that series match all of
    """
    if type(tag_names) == str: tag_names = [tag_names]
    url = f"{BASE_URL}/category/related_tags?category_id={category_id}&tag_names={';'.join(tag_names)}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# ---------- Releases ----------

# fred/release
def get_release(release_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/releases.html
    Description: Get a release of economic data.
    Input: The id for a release.
    """
    url = f"{BASE_URL}/release?release_id={release_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["releases"][0]

# fred/release/series
def get_release_series(release_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/release_series.html
    Description: Get the series on a release of economic data.
    Input: The id for a release.
    """
    url = f"{BASE_URL}/release?series={release_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# fred/release/sources
def get_release_series(release_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/release_sources.html
    Description: Get the sources for a release of economic data.
    Input: The id for a release.
    """
    url = f"{BASE_URL}/release?sources={release_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["sources"][0]

# fred/release/tags
def get_release_series(release_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/release_tags.html
    Description: Get the FRED tags for a release. Optionally, filter results by tag name, tag group, or search.
    Input: The id for a release.
    """
    url = f"{BASE_URL}/release?tags={release_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# fred/release/related_tags
def get_release_series(release_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/release_related_tags.html
    Description: Get the related FRED tags for one or more FRED tags within a release.
    Input: The id for a release.
    """
    url = f"{BASE_URL}/release?related_tags={release_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# fred/release/tables
def get_release_tables(release_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/release_tables.html
    Description: Get release table trees for a given release. You can go directly to the tree structure by passing the appropriate element_id. You may also use a drill-down approach to start at the root (top most) element by leaving the element_id off.
    Input: The id for a release.
    """
    url = f"{BASE_URL}/release?tables={release_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["elements"][0]

# fred/releases
def get_releases():
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/releases.html
    Description: Get all releases of economic data.
    """
    url = f"{BASE_URL}/releases?api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["releases"][0]

# fred/release/dates
def get_releases_dates(release_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/release_dates.html
    Description: Get release dates for a release of economic data.
    Input: The id for a release.
    """
    url = f"{BASE_URL}/release/dates?release_id={release_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["release_dates"][0]

# fred/releases/dates
def get_releases_dates():
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/releases_dates.html
    Description: Get release dates for all releases of economic data.
    """
    url = f"{BASE_URL}/releases/dates?api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["release_dates"][0]

# ---------- Series ----------

# fred/series
def get_series_info(series_id):
    """
    Description: Get an economic data series.
    Input: The id for a series.
    """
    url = f"{BASE_URL}/series?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# fred/series/categories
def get_series_categories(series_id):
    """
    Description: Get the categories for an economic data series.
    Input: The id for a series.
    """
    url = f"{BASE_URL}/series/categories?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# fred/series/observations
def get_series_observations(series_id):
    """
    Description: Get the observations or data values for an economic data series.
    Input: The id for a series.
    """
    url = f"{BASE_URL}/series/observations?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# fred/series/release
def get_series_release(series_id):
    """
    Description: Get the release for an economic data series.
    Input: The id for a series.
    """
    url = f"{BASE_URL}/series/release?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# fred/series/search
def get_series_search(search_text):
    """
    Description: Get economic data series that match search text.
    Input: The words to match against economic data series.
    """
    url = f"{BASE_URL}/series/search?search_text={search_text.replace(' ', '+')}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# fred/series/search/tags
def get_series_search(search_text):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/series_search_tags.html
    Description: Get the FRED tags for a series search. Optionally, filter results by tag name, tag group, or tag search.
    Input: The words to match against economic data series.
    """
    url = f"{BASE_URL}/series/search?search_text={search_text.replace(' ', '+')}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# fred/series/search/related_tags
def get_series_search(search_text):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/series_search_related_tags.html
    Description: Get the related FRED tags for one or more FRED tags matching a series search. Optionally, filter results by tag group or tag search.
    Input: The words to match against economic data series.
    """
    url = f"{BASE_URL}/series/search/related_tags?search_text={search_text.replace(' ', '+')}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# fred/series/tags
def get_series_tags(series_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/series_tags.html
    Description: Get the FRED tags for a series.
    Input: The id for a series.
    """
    url = f"{BASE_URL}/series/tags?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# fred/series/updates
def get_series_updates():
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/series_updates.html
    Description: Get economic data series sorted by when observations were updated on the FRED® server (attribute last_updated). Results are limited to series updated within the last two weeks.
    """
    url = f"{BASE_URL}/series/updates&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# fred/series/vintagedates
def get_series_vintagedates(series_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/series_vintagedates.html
    Description: Get the dates in history when a series' data values were revised or new data values were released. Vintage dates are the release dates for a series excluding release dates when the data for the series did not change.
    Input: The id for a series.
    """
    url = f"{BASE_URL}/series/vintagedates?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["seriess"][0]

# ---------- Sources ----------

# fred/source
def get_source(source_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/source.html
    Description: Get a source of economic data.
    """
    url = f"{BASE_URL}/source?source_id={source_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["sources"][0]

# fred/source/releases
def get_source(source_id):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/source_releases.html
    Description: Get the releases for a source.
    """
    url = f"{BASE_URL}/source/releases?source_id={source_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["releases"][0]

# fred/sources
def get_sources():
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/sources.html
    Description: Get all sources of economic data.
    """
    url = f"{BASE_URL}/sources&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["sources"][0]

# ---------- Tags ----------

# fred/tags
def get_tags():
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/tags.html
    Description: Get FRED tags. 
    """
    url = f"{BASE_URL}/tags&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# fred/related_tags
def get_related_tags(tag_names):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/related_tags.html
    Description: Get the related FRED tags for one or more FRED tags
    Input: A semicolon delimited list of tag names that series match all of.
    """
    if type(tag_names) == str: tag_names = [tag_names]
    url = f"{BASE_URL}/related_tags?tag_names={';'.join(tag_names.replace(' ', '+'))}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["tags"][0]

# fred/tags/series
def get_tags_series(tag_names):
    """
    URL: https://fred.stlouisfed.org/docs/api/fred/tags_series.html
    Description: Get the series matching all tags in the tag_names parameter and no tags in the exclude_tag_names parameter.
    Input: A semicolon delimited list of tag names that series match all of.
    """
    if type(tag_names) == str: tag_names = [tag_names]
    url = f"{BASE_URL}/tags/series?tag_names={';'.join(tag_names.replace(' ', '+'))}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    return r.json()["series"][0]

# Função para baixar os dados da série
def download_series_data(series_id):
    url = f"{BASE_URL}/series/observations?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json"
    r = requests.get(url)
    data = r.json()["observations"]
    df = pd.DataFrame(data)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df["date"] = pd.to_datetime(df["date"])
    df.to_csv(DATA_DIR / f"{series_id}.csv", index=False)
    return df

# Executar o download e montar o dicionário
metadata_list = []

for sid, description in series_ids.items():
    print(f"Baixando {sid}...")
    meta = get_series_info(sid)
    download_series_data(sid)
    
    metadata_list.append({
        "id": sid,
        "title": meta["title"],
        "frequency": meta["frequency"],
        "units": meta["units"],
        "seasonal_adjustment": meta["seasonal_adjustment"],
        "last_updated": meta["last_updated"],
        "observation_start": meta["observation_start"],
        "observation_end": meta["observation_end"],
        "description": description
    })

# Criar dicionário de metadados
meta_df = pd.DataFrame(metadata_list)
meta_df.to_csv(DATA_DIR / "series_metadata.csv", index=False)
meta_df